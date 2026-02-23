/**
 * Conversation Types
 * Moved from index.ts to break circular dependency
 */

/**
 * Stato della conversazione.
 */
export type ConversationStatus = 'active' | 'archived' | 'deleted';

/**
 * Dominio della conversazione (per context routing).
 */
export type ChatDomain =
  | 'general'
  | 'workout'
  | 'nutrition'
  | 'analytics'
  | 'coach'
  | 'marketplace'
  | 'support';

/**
 * Conversazione chat.
 */
export interface ChatConversation {
  /** ID univoco della conversazione */
  id: string;
  /** Titolo generato o custom */
  title: string;
  /** Anteprima dell'ultimo messaggio */
  preview: string;
  /** Data ultimo aggiornamento */
  updatedAt: Date;
  /** Data creazione */
  createdAt?: Date;
  /** Dominio della conversazione */
  domain?: ChatDomain;
  /** Stato della conversazione */
  status?: ConversationStatus;
  /** Numero messaggi */
  messageCount?: number;
  /** Metadati aggiuntivi */
  metadata?: Record<string, unknown>;
}
