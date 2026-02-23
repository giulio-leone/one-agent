/**
 * Chat Types
 *
 * Tipi per useCoachChat e componenti chat.
 */

// ============================================================================
// Core Types
// ============================================================================

import type {
  ChatStatus,
  UIMessage,
  MessagePart,
  UnknownMessagePart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
  ReasoningPart,
  FilePart,
} from '@giulio-leone/types/chat';

export type {
  ChatStatus,
  UIMessage,
  MessagePart,
  UnknownMessagePart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
  ReasoningPart,
  FilePart,
};

/**
 * Raw AI SDK message part (runtime payload, permissive by design)
 */
export interface AISDKMessagePart {
  type: string;
  text?: string;
  reasoning?: string;
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  output?: unknown;
  [key: string]: unknown;
}

/**
 * Raw AI SDK message (runtime payload, permissive by design)
 */
export interface AISDKMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: AISDKMessagePart[];
}

/**
 * Chat request message used across API/client
 */
export interface ChatRequestMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  parts?: AISDKMessagePart[];
}

// ============================================================================
// Hook Options
// ============================================================================

/**
 * Messaggio iniziale legacy (per backward compatibility)
 */
export interface LegacyMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
}

/**
 * Opzioni per useCoachChat
 */
export interface UseCoachChatOptions {
  /** API endpoint */
  api?: string;

  /** ID conversazione esistente */
  conversationId?: string | null;

  /** Messaggi iniziali */
  initialMessages?: LegacyMessage[];

  /** Body statico da inviare con ogni richiesta */
  body?: Record<string, unknown>;

  /** Callback quando arriva un nuovo messaggio */
  onMessage?: (message: UIMessage) => void;

  /** Callback su errore */
  onError?: (error: Error) => void;

  /** Callback quando un messaggio è completato */
  onFinish?: () => void;

  /** Abilita/disabilita la chat */
  enabled?: boolean;
}

// ============================================================================
// Hook Result
// ============================================================================

/**
 * Risultato di useCoachChat
 */
export interface CoachChatResult {
  // Messages
  messages: UIMessage[];
  setMessages: (messages: UIMessage[]) => void;

  // Input
  input: string;
  setInput: (input: string) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

  // Actions
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;
  reload: () => Promise<void>;
  reset: () => void;

  // Status
  status: ChatStatus;
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | null;

  // Conversation
  conversationId: string | null;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Body della richiesta chat
 */
export interface ChatRequestBody {
  /** ID conversazione */
  conversationId?: string | null;

  /** ID utente (opzionale, estratto da auth) */
  userId?: string;

  /** Tier del modello */
  tier?: 'fast' | 'balanced' | 'quality';

  /** Dominio contestuale */
  domain?: string;

  /** Override del modello */
  modelOverride?: string;

  /** Abilita reasoning */
  reasoning?: boolean;

  /** Profilo utente per personalizzazione */
  userProfile?: {
    name?: string;
    preferences?: Record<string, unknown>;
    goals?: string[];
  };
}

/**
 * Headers della risposta chat
 */
export interface ChatResponseHeaders {
  'x-conversation-id'?: string;
  'x-model-used'?: string;
}
