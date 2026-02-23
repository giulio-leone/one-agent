/**
 * useChatRealtime Hook
 *
 * Hook per sincronizzazione Realtime dei messaggi chat con Supabase.
 * Usa lo store Realtime esistente per gestire le sottoscrizioni.
 *
 * PRINCIPI:
 * - KISS: Wrappa logica esistente di realtime.store
 * - SOLID: Single Responsibility - solo sync Realtime chat
 * - DRY: Riusa useRealtimeSubscription
 */

'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useRealtimeStore, selectIsRealtimeReady } from '@giulio-leone/lib-stores';
import type {
  ChatMessage,
  UseChatRealtimeOptions,
  RealtimeMessageEvent,
  UseChatCoreOptions,
} from '../types';

// ============================================================================
// Types
// ============================================================================

interface DBMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
  user_id: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook per sottoscrivere ai cambiamenti Realtime sui messaggi chat.
 *
 * @example
 * ```tsx
 * // Sottoscrivi a una conversazione specifica
 * useChatRealtime({
 *   conversationId: 'abc123',
 *   userId: user.id,
 *   enabled: !!user.id,
 *   onMessage: (message, event) => {
 *     if (event === 'INSERT') {
 *       // Nuovo messaggio arrivato
 *       addToMessages(message);
 *     }
 *   },
 * });
 * ```
 */
export function useChatRealtime(options: UseChatRealtimeOptions): void {
  const {
    conversationId,
    // userId non usato direttamente, serve per future estensioni
    enabled = true,
    onMessage,
    onError,
  } = options;

  const isReady = useRealtimeStore(selectIsRealtimeReady);
  const subscribe = useRealtimeStore((state) => state.subscribe);

  // Refs per callback stabili
  const callbacksRef = useRef({ onMessage, onError });
  callbacksRef.current = { onMessage, onError };

  // Handler per conversione e callback
  const handleMessage = useCallback(
    (event: RealtimeMessageEvent) => (record: DBMessage) => {
      try {
        // Converti record DB in ChatMessage
        const message: ChatMessage = {
          id: record.id,
          role: record.role as ChatMessage['role'],
          content: record.content,
          createdAt: record.created_at ? new Date(record.created_at) : undefined,
          metadata: {
            conversationId: record.conversation_id,
            ...record.metadata,
          },
        };

        callbacksRef.current.onMessage?.(message, event);
      } catch (error) {
        logger.error('[useChatRealtime] Error converting message:', error);
        callbacksRef.current.onError?.(error as Error);
      }
    },
    []
  );

  useEffect(() => {
    // Guards
    if (!isReady || !enabled || !conversationId) {
      return;
    }

    // Crea filter per la conversazione specifica
    const filter = `conversation_id=eq.${conversationId}`;

    // Sottoscrivi alla tabella chat_messages
    const unsubscribe = subscribe<DBMessage>(
      'chat_messages',
      {
        onInsert: handleMessage('INSERT'),
        onUpdate: handleMessage('UPDATE'),
        onDelete: handleMessage('DELETE'),
        onError: (error) => callbacksRef.current.onError?.(error),
      },
      { filter }
    );

    return unsubscribe;
  }, [isReady, enabled, conversationId, subscribe, handleMessage]);
}

// ============================================================================
// Convenience Hook: useChatConversationsRealtime
// ============================================================================

interface UseConversationsRealtimeOptions {
  userId: string | null;
  enabled?: boolean;
  onConversationUpdate?: (
    conversation: {
      id: string;
      title: string;
      updatedAt: Date;
    },
    event: RealtimeMessageEvent
  ) => void;
  onError?: (error: Error) => void;
}

interface DBConversation {
  id: string;
  user_id: string;
  title: string;
  updated_at: string;
  created_at: string;
  domain?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook per sottoscrivere ai cambiamenti Realtime sulle conversazioni.
 *
 * @example
 * ```tsx
 * useChatConversationsRealtime({
 *   userId: user.id,
 *   enabled: !!user.id,
 *   onConversationUpdate: (conversation, event) => {
 *     if (event === 'INSERT') {
 *       addConversation(conversation);
 *     } else if (event === 'UPDATE') {
 *       updateConversation(conversation);
 *     } else if (event === 'DELETE') {
 *       removeConversation(conversation.id);
 *     }
 *   },
 * });
 * ```
 */
export function useChatConversationsRealtime(options: UseConversationsRealtimeOptions): void {
  const { userId, enabled = true, onConversationUpdate, onError } = options;

  const isReady = useRealtimeStore(selectIsRealtimeReady);
  const subscribe = useRealtimeStore((state) => state.subscribe);

  // Refs per callback stabili
  const callbacksRef = useRef({ onConversationUpdate, onError });
  callbacksRef.current = { onConversationUpdate, onError };

  // Handler per conversione e callback
  const handleConversation = useCallback(
    (event: RealtimeMessageEvent) => (record: DBConversation) => {
      try {
        const conversation = {
          id: record.id,
          title: record.title || 'Nuova conversazione',
          updatedAt: new Date(record.updated_at),
        };

        callbacksRef.current.onConversationUpdate?.(conversation, event);
      } catch (error) {
        logger.error('[useChatConversationsRealtime] Error:', error);
        callbacksRef.current.onError?.(error as Error);
      }
    },
    []
  );

  useEffect(() => {
    // Guards
    if (!isReady || !enabled || !userId) {
      return;
    }

    // Crea filter per l'utente specifico
    const filter = `user_id=eq.${userId}`;

    // Sottoscrivi alla tabella chat_conversations
    const unsubscribe = subscribe<DBConversation>(
      'chat_conversations',
      {
        onInsert: handleConversation('INSERT'),
        onUpdate: handleConversation('UPDATE'),
        onDelete: handleConversation('DELETE'),
        onError: (error) => callbacksRef.current.onError?.(error),
      },
      { filter }
    );

    return unsubscribe;
  }, [isReady, enabled, userId, subscribe, handleConversation]);
}

// ============================================================================
// Combined Hook: useChatWithRealtime
// ============================================================================

import { useChatCore } from './use-chat-core';
import { logger } from '@giulio-leone/lib-core';

interface UseChatWithRealtimeOptions extends UseChatCoreOptions {
  userId?: string;
  realtimeEnabled?: boolean;
}

/**
 * Hook combinato che unisce useChatCore con sincronizzazione Realtime.
 *
 * @example
 * ```tsx
 * const {
 *   messages,
 *   input,
 *   setInput,
 *   sendMessage,
 *   status,
 * } = useChatWithRealtime({
 *   conversationId: 'abc123',
 *   userId: user.id,
 *   realtimeEnabled: true,
 * });
 * ```
 */
export function useChatWithRealtime(options: UseChatWithRealtimeOptions) {
  const { userId, realtimeEnabled = true, ...chatOptions } = options;

  // Hook base per la chat
  const chatResult = useChatCore(chatOptions);

  // Sottoscrizione Realtime per messaggi da altri client/dispositivi
  useChatRealtime({
    conversationId: chatResult.conversationId,
    userId,
    enabled: realtimeEnabled && !!chatResult.conversationId,
    onMessage: (message, event) => {
      // Qui potremmo aggiornare i messaggi se arrivano da altri client
      // Per ora loggiamo solo in development
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`[useChatWithRealtime] Realtime event: ${event} - Message ID: ${message.id}`);
      }
    },
  });

  return chatResult;
}
