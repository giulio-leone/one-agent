/**
 * Chat Core Types
 *
 * Tipi condivisi per Chat e Copilot.
 * SSOT (Single Source of Truth) per tutte le definizioni di tipo.
 *
 * PRINCIPI:
 * - KISS: Tipi semplici e intuitivi
 * - SOLID: Interface segregation - tipi separati per scopi diversi
 * - DRY: Un solo posto per tutti i tipi chat-related
 *
 * NOTE: Per UIMessage, usa il tipo nativo di @ai-sdk/react o 'ai'.
 * I componenti UI possono usare i type guard qui definiti per il rendering.
 */

import type { UIMessage as AIUIMessage } from '@ai-sdk/react';

// Re-export UIMessage from AI SDK for consumers
export type UIMessage = AIUIMessage;

// Re-export unified chat types
export * from './unified-chat';

import type { ChatConversation } from './conversation';

// ============================================================================
// Tool State (AI SDK v6 compatible)
// ============================================================================

/**
 * Tool State aligned with AI SDK v6 ToolUIPart states
 */
export type ToolState =
  | 'input-streaming'
  | 'input-available'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-available'
  | 'output-error'
  | 'output-denied';

// ============================================================================
// Type Guards for Message Parts
// ============================================================================

/**
 * Type for text parts
 */
export interface TextUIPart {
  type: 'text';
  text: string;
}

/**
 * Type for reasoning parts
 */
export interface ReasoningUIPart {
  type: 'reasoning';
  text: string;
}

/**
 * Type for tool invocation parts (simplified for rendering)
 */
export interface ToolUIPart {
  type: `tool-${string}` | 'dynamic-tool';
  toolCallId: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  result?: unknown;
  state: ToolState;
  errorText?: string;
}

/**
 * Type guard to check if a UI part is a text part (for UIMessage.parts)
 */
export function isUITextPart(part: { type: string }): part is TextUIPart {
  return part.type === 'text';
}

/**
 * Type guard to check if a UI part is a reasoning part (for UIMessage.parts)
 */
export function isUIReasoningPart(part: { type: string }): part is ReasoningUIPart {
  return part.type === 'reasoning';
}

/**
 * Type guard to check if a UI part is a tool part (for UIMessage.parts)
 */
export function isUIToolPart(part: { type: string }): part is ToolUIPart {
  return part.type.startsWith('tool-') || part.type === 'dynamic-tool';
}

/**
 * Helper to get text content from UI message parts
 */
export function getUIMessageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p): p is TextUIPart => isUITextPart(p))
    .map((p: any) => p.text)
    .join('');
}

// ============================================================================
// Message Types (AI SDK v6 compatible)
// ============================================================================

/**
 * Ruoli supportati nei messaggi.
 * Allineato con AI SDK v6 (user, assistant, system).
 */
export type ChatRole = 'user' | 'assistant' | 'system';

/**
 * Parte generica del messaggio per compatibilità DB.
 * Per UI/Rendering, preferire i tipi di 'ai' SDK.
 */
export interface MessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

/**
 * Messaggio chat unificato.
 * @deprecated Per nuovi componenti UI usa UIMessage da 'ai'.
 * ChatMessage rimane per persistenza DB e legacy.
 */
export interface ChatMessage {
  /** ID univoco del messaggio */
  id: string;
  /** Ruolo del mittente */
  role: ChatRole;
  /** Contenuto testuale (per persistenza) */
  content: string;
  /** Parti del messaggio (AI SDK v6) */
  parts?: MessagePart[];
  /** Timestamp di creazione */
  createdAt?: Date;
  /** Metadati aggiuntivi */
  metadata?: ChatMessageMetadata;
}

/**
 * Metadati opzionali del messaggio.
 */
export interface ChatMessageMetadata {
  /** ID conversazione di appartenenza */
  conversationId?: string;
  /** Model usato per generare la risposta */
  model?: string;
  /** Token usati */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Latenza in ms */
  latencyMs?: number;
  /** Tags per categorizzazione */
  tags?: string[];
  /** Dati custom */
  [key: string]: unknown;
}

// Re-export conversation types
export * from './conversation';

// ============================================================================
// Chat Status Types (AI SDK v6)
// ============================================================================

/**
 * Stati del chat (AI SDK v6).
 * Sostituisce il vecchio isLoading boolean.
 */
export type ChatStatus =
  | 'ready' // Pronto per inviare
  | 'submitted' // Messaggio inviato, in attesa
  | 'streaming' // Ricevendo risposta in streaming
  | 'error'; // Errore

/**
 * Mappa ChatStatus a stati UI semplificati.
 */
export const isChatBusy = (status: ChatStatus): boolean =>
  status === 'submitted' || status === 'streaming';

// ============================================================================
// Hook Options Types
// ============================================================================

/**
 * Opzioni per useChatCore hook.
 */
export interface UseChatCoreOptions {
  /** API endpoint per chat */
  api?: string;
  /** ID conversazione (undefined = nuova) */
  conversationId?: string | null;
  /** Messaggi iniziali (legacy format per caricamento da DB) */
  initialMessages?: ChatMessage[];
  /** Model da usare */
  model?: string;
  /** System prompt */
  systemPrompt?: string;
  /** Body aggiuntivo da inviare all'API */
  body?: Record<string, unknown>;
  /** Callbacks */
  onMessage?: (message: UIMessage) => void;
  onError?: (error: Error) => void;
  onConversationCreated?: (id: string) => void;
  onFinish?: () => void;
  /** Abilita/disabilita */
  enabled?: boolean;
}

/**
 * Risultato di useChatCore hook.
 * NOTA: messages è UIMessage[] nativo AI SDK v6.
 * Usa message.parts[] per il rendering.
 */
export interface UseChatCoreResult {
  /** Messaggi della conversazione (UIMessage[] nativo) */
  messages: UIMessage[];
  /** Input corrente */
  input: string;
  /** Setter per input */
  setInput: (input: string) => void;
  /** Invia messaggio */
  sendMessage: (options?: { text?: string }) => Promise<void>;
  /** Imposta messaggi */
  setMessages: (messages: UIMessage[]) => void;
  /** Stato corrente */
  status: ChatStatus;
  /** Se è in corso un'operazione */
  isLoading: boolean;
  /** Ultimo errore */
  error: Error | null;
  /** Ferma generazione */
  stop: () => void;
  /** Ricarica ultimo messaggio */
  reload: () => Promise<void>;
  /** Reset conversazione */
  reset: () => void;
  /** ID conversazione corrente */
  conversationId: string | null;
}

// ============================================================================
// Realtime Types
// ============================================================================

/**
 * Evento Realtime per messaggi.
 */
export type RealtimeMessageEvent = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Payload Realtime per messaggi.
 */
export interface RealtimeMessagePayload {
  eventType: RealtimeMessageEvent;
  new: ChatMessage;
  old: ChatMessage;
}

/**
 * Opzioni per useChatRealtime hook.
 */
export interface UseChatRealtimeOptions {
  /** ID conversazione da osservare */
  conversationId: string | null;
  /** User ID per filtrare */
  userId?: string;
  /** Abilita/disabilita */
  enabled?: boolean;
  /** Callback per nuovi messaggi */
  onMessage?: (message: ChatMessage, event: RealtimeMessageEvent) => void;
  /** Callback per errori */
  onError?: (error: Error) => void;
}

// ============================================================================
// Component Types
// ============================================================================

/**
 * Variante visuale dei componenti chat.
 */
export type ChatVariant = 'default' | 'compact' | 'embedded' | 'floating';

/**
 * Props base per MessageBubble.
 */
export interface MessageBubbleProps {
  /** Messaggio da visualizzare */
  message: ChatMessage;
  /** Variante visuale */
  variant?: ChatVariant;
  /** Se è in streaming */
  isStreaming?: boolean;
  /** Avatar utente/assistant */
  avatar?: {
    user?: string;
    assistant?: string;
  };
  /** Azioni sul messaggio */
  onCopy?: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  /** Custom rendering */
  renderContent?: (content: string) => React.ReactNode;
  /** Classi CSS aggiuntive */
  className?: string;
}

/**
 * Props base per ChatInput.
 */
export interface ChatInputProps {
  /** Valore input */
  value: string;
  /** Setter input */
  onChange: (value: string) => void;
  /** Handler invio */
  onSend: () => void;
  /** Handler stop */
  onStop?: () => void;
  /** Se è in loading */
  isLoading?: boolean;
  /** Placeholder */
  placeholder?: string;
  /** Variante visuale */
  variant?: ChatVariant;
  /** Disabilitato */
  disabled?: boolean;
  /** Max caratteri */
  maxLength?: number;
  /** Auto focus */
  autoFocus?: boolean;
  /** Azioni aggiuntive (file upload, voice, etc) */
  actions?: React.ReactNode;
  /** Classi CSS aggiuntive */
  className?: string;
}

/**
 * Props per ConversationList.
 */
export interface ConversationListProps {
  /** Lista conversazioni */
  conversations: ChatConversation[];
  /** ID conversazione attiva */
  activeId?: string | null;
  /** Handler selezione */
  onSelect: (id: string) => void;
  /** Handler elimina */
  onDelete?: (id: string) => void;
  /** Handler nuova conversazione */
  onNew?: () => void;
  /** Se sta caricando */
  isLoading?: boolean;
  /** Variante visuale */
  variant?: ChatVariant;
  /** Classi CSS aggiuntive */
  className?: string;
}

// ============================================================================
// Store Types (per estensione lib-stores)
// ============================================================================

/**
 * Slice dello store per chat (estende ChatStore esistente).
 */
export interface ChatRealtimeSlice {
  /** Sottoscrizione attiva per conversazione corrente */
  realtimeSubscribed: boolean;
  /** Ultimo sync timestamp */
  lastSyncAt: Date | null;
  /** Errore realtime */
  realtimeError: Error | null;
  /** Azioni */
  subscribeRealtime: (conversationId: string) => void;
  unsubscribeRealtime: () => void;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Request body per chat API.
 */
export interface ChatApiRequest {
  /** Messaggi della conversazione */
  messages: ChatMessage[];
  /** ID conversazione (opzionale) */
  conversationId?: string;
  /** Model da usare */
  model?: string;
  /** System prompt */
  systemPrompt?: string;
  /** Context aggiuntivo */
  context?: Record<string, unknown>;
}

/**
 * Response dalla chat API (streaming).
 */
export interface ChatApiResponse {
  /** ID messaggio generato */
  id: string;
  /** ID conversazione */
  conversationId: string;
  /** Contenuto (per non-streaming) */
  content?: string;
}
