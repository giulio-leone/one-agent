/**
 * Message Utilities
 *
 * Funzioni helper per la gestione dei messaggi chat.
 * AI SDK v6 nativo - UIMessage con parts[].
 *
 * PRINCIPI:
 * - KISS: Funzioni pure, senza side effects
 * - SOLID: Single Responsibility per ogni funzione
 * - DRY: Logica centralizzata
 */

import type { ChatMessage, ChatRole, MessagePart } from '../types';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Verifica se una parte è di tipo testo.
 */
export function isTextPart(
  part: MessagePart
): part is MessagePart & { type: 'text'; text: string } {
  return part.type === 'text';
}

/**
 * Verifica se un ruolo è valido.
 */
export function isValidRole(role: unknown): role is ChatRole {
  return role === 'user' || role === 'assistant' || role === 'system' || role === 'tool';
}

// ============================================================================
// Message Creation Helpers
// ============================================================================

/**
 * Genera un ID univoco per un messaggio.
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Crea un nuovo messaggio utente.
 */
export function createUserMessage(content: string, id?: string): ChatMessage {
  return {
    id: id || generateMessageId(),
    role: 'user',
    content,
    parts: [{ type: 'text', text: content }],
    createdAt: new Date(),
  };
}

/**
 * Crea un nuovo messaggio assistant.
 */
export function createAssistantMessage(content: string, id?: string): ChatMessage {
  return {
    id: id || generateMessageId(),
    role: 'assistant',
    content,
    parts: [{ type: 'text', text: content }],
    createdAt: new Date(),
  };
}

/**
 * Crea un messaggio di sistema.
 */
export function createSystemMessage(content: string, id?: string): ChatMessage {
  return {
    id: id || generateMessageId(),
    role: 'system',
    content,
    parts: [{ type: 'text', text: content }],
    createdAt: new Date(),
  };
}

// ============================================================================
// Message Formatting
// ============================================================================

/**
 * Tronca il contenuto di un messaggio per la preview.
 */
export function truncateMessageContent(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength).trim() + '...';
}

/**
 * Estrae il titolo suggerito da una conversazione.
 * Usa il primo messaggio utente, troncato.
 */
export function extractConversationTitle(messages: ChatMessage[], maxLength: number = 50): string {
  const firstUserMessage = messages.find((m) => m.role === 'user');
  if (!firstUserMessage) return 'Nuova conversazione';
  return truncateMessageContent(firstUserMessage.content, maxLength);
}

/**
 * Estrae la preview da una conversazione.
 * Usa l'ultimo messaggio, troncato.
 */
export function extractConversationPreview(
  messages: ChatMessage[],
  maxLength: number = 100
): string {
  if (messages.length === 0) return '';
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) return '';
  return truncateMessageContent(lastMessage.content, maxLength);
}

// ============================================================================
// Message Filtering & Sorting
// ============================================================================

/**
 * Filtra messaggi per ruolo.
 */
export function filterMessagesByRole(messages: ChatMessage[], role: ChatRole): ChatMessage[] {
  return messages.filter((m) => m.role === role);
}

/**
 * Ordina messaggi per data.
 */
export function sortMessagesByDate(
  messages: ChatMessage[],
  order: 'asc' | 'desc' = 'asc'
): ChatMessage[] {
  return [...messages].sort((a, b) => {
    const dateA = a.createdAt?.getTime() || 0;
    const dateB = b.createdAt?.getTime() || 0;
    return order === 'asc' ? dateA - dateB : dateB - dateA;
  });
}

/**
 * Rimuove messaggi di sistema dalla lista (per display).
 */
export function filterDisplayableMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((m) => m.role !== 'system');
}

// ============================================================================
// Message Validation
// ============================================================================

/**
 * Verifica se un messaggio è valido.
 */
export function isValidMessage(message: unknown): message is ChatMessage {
  if (!message || typeof message !== 'object') return false;
  const m = message as Record<string, unknown>;
  return typeof m.id === 'string' && isValidRole(m.role) && typeof m.content === 'string';
}

/**
 * Sanitizza il contenuto di un messaggio rimuovendo caratteri problematici.
 */
export function sanitizeMessageContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n') // Normalizza line endings
    .replace(/\0/g, '') // Rimuovi null bytes
    .trim();
}

// ============================================================================
// Message Comparison
// ============================================================================

/**
 * Verifica se due messaggi sono uguali (per deduplicazione).
 */
export function areMessagesEqual(a: ChatMessage, b: ChatMessage): boolean {
  return a.id === b.id;
}

/**
 * Trova messaggi nuovi confrontando due liste.
 */
export function findNewMessages(current: ChatMessage[], previous: ChatMessage[]): ChatMessage[] {
  const previousIds = new Set(previous.map((m) => m.id));
  return current.filter((m) => !previousIds.has(m.id));
}
