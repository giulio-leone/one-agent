/**
 * useCoachChat Hook
 *
 * Hook unificato per Chat/Copilot usando AI SDK v6.
 * SSOT per tutti gli usi di chat nell'app.
 *
 * PRINCIPI:
 * - KISS: Usa AI SDK useChat direttamente
 * - SOLID: Single Responsibility - solo logica chat
 * - DRY: Un hook per Chat e Copilot
 */

'use client';

import { useChat } from '@ai-sdk/react';
import type {
  ChatStatus,
  MessagePart,
  UIMessage,
} from '../types';
import type {
  AISDKMessage,
  AISDKMessagePart,
  CoachChatResult,
  LegacyMessage,
  UseCoachChatOptions,
} from '../types/chat-agent';
import { useCallback, useEffect, useRef, useState } from 'react';

import { logger } from '@giulio-leone/lib-shared';
// ============================================================================
// Constants
// ============================================================================

const DEFAULT_API = '/api/chat';
const DEBUG = process.env.NODE_ENV === 'development';

function log(message: string, data?: unknown) {
  if (DEBUG) {
    logger.warn(`[useCoachChat] ${message}`, data ?? '');
  }
}

// ============================================================================
// Types for messages from AI SDK
// ============================================================================
// (Removed unused AIMessage interface - types are now inferred from AI SDK)

// ============================================================================
// Hook
// ============================================================================

/**
 * Main chat hook per onecoach.
 * Usa AI SDK v6 useChat con supporto per transport personalizzato.
 */
export function useCoachChat(options: UseCoachChatOptions = {}): CoachChatResult {
  const {
    api = DEFAULT_API,
    conversationId: externalConversationId,
    initialMessages = [] as LegacyMessage[],
    body: staticBody = {},
    onMessage,
    onError,
    onFinish,
    enabled = true,
  } = options;

  // Managed input state (AI SDK v6 requires manual input management)
  const [input, setInput] = useState('');

  // Conversation state - managed from headers response
  const [conversationId, setConversationId] = useState<string | null>(
    externalConversationId ?? null
  );

  // Track processed messages for onMessage callback
  const lastProcessedRef = useRef<string | null>(null);

  // Create transport configuration
  const requestBody = {
    ...staticBody,
    conversationId,
  };

  // AI SDK v6 useChat hook
  const chatResult = useChat({
    id: conversationId ?? undefined,
    api,
    body: requestBody,
    credentials: 'include',
    messages: initialMessages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: [{ type: 'text' as const, text: message.content }],
    })),
    onFinish: () => {
      log('Conversation finished');
      onFinish?.();
    },
    onError: (err: Error) => {
      logger.error('[useCoachChat] Error:', err);
      onError?.(err);
    },
  });

  const {
    messages: rawMessages,
    sendMessage: aiSendMessage,
    status: rawStatus,
    error,
    stop,
    setMessages: aiSetMessages,
    regenerate,
  } = chatResult;

  // Cast messages to our internal type
  const messages = rawMessages as AISDKMessage[];
  const status = rawStatus as ChatStatus;

  // Process new messages for callbacks
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.id !== lastProcessedRef.current) {
      lastProcessedRef.current = lastMessage.id;

      // Convert to UIMessage format
      const parts: MessagePart[] = (lastMessage.parts ?? []).map((p: AISDKMessagePart) => {
        switch (p.type) {
          case 'text':
            return { type: 'text', text: p.text ?? '' };
          case 'reasoning':
            return { type: 'reasoning', reasoning: p.reasoning ?? '' };
          case 'tool-call':
            return {
              type: 'tool-call',
              toolCallId: p.toolCallId ?? '',
              toolName: p.toolName ?? '',
              args: p.args ?? {},
            };
          case 'tool-result':
            return {
              type: 'tool-result',
              toolCallId: p.toolCallId ?? '',
              toolName: p.toolName ?? '',
              // AI SDK v6 può esporre `result` oppure `output` sui tool-result.
              // Per coerenza con i renderer (Plan/Task) normalizziamo qui.
              result: p.result ?? p.output,
            };
          default:
            return { type: 'text', text: p.text ?? '' };
        }
      });

      const content = parts
        .filter((p): p is MessagePart & { type: 'text' } => p.type === 'text')
        .map((p) => p.text)
        .join('');

      const uiMessage: UIMessage = {
        id: lastMessage.id,
        role: lastMessage.role,
        content,
        parts,
      };
      onMessage?.(uiMessage);
    }
  }, [messages, onMessage]);

  // handleInputChange for form inputs
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    [setInput]
  );

  // handleSubmit for form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!enabled || !input.trim()) return;
      log('Submitting message', { text: input.slice(0, 50) });

      const textToSend = input;
      setInput(''); // Clear input immediately

      await aiSendMessage({ text: textToSend });
    },
    [enabled, input, aiSendMessage, setInput]
  );

  // Send message programmatically
  const sendMessage = useCallback(
    async (text: string) => {
      if (!enabled || !text.trim()) return;
      log('Sending message programmatically', { text: text.slice(0, 50) });
      await aiSendMessage({ text });
    },
    [enabled, aiSendMessage]
  );

  // Reload last message (uses regenerate in v6)
  const reload = useCallback(async () => {
    await regenerate?.();
  }, [regenerate]);

  // Reset chat
  const reset = useCallback(() => {
    log('Resetting chat');
    aiSetMessages([]);
    setInput('');
    setConversationId(null);
    lastProcessedRef.current = null;
  }, [aiSetMessages, setInput, setConversationId]);

  // Compute derived states
  const isLoading = status === 'submitted' || status === 'streaming';
  const isStreaming = status === 'streaming';

  // Convert messages to UIMessage format
  const uiMessages: UIMessage[] = messages.map((message) => {
    const parts: MessagePart[] = (message.parts ?? []).map((part: AISDKMessagePart) => {
      switch (part.type) {
        case 'text':
          return { type: 'text', text: part.text ?? '' };
        case 'reasoning':
          return { type: 'reasoning', reasoning: part.reasoning ?? '' };
        case 'tool-call':
          return {
            type: 'tool-call',
            toolCallId: part.toolCallId ?? '',
            toolName: part.toolName ?? '',
            args: part.args ?? {},
          };
        case 'tool-result':
          return {
            type: 'tool-result',
            toolCallId: part.toolCallId ?? '',
            toolName: part.toolName ?? '',
            // Stesso normalizzatore usato sopra: preferisci result, fallback su output.
            result: part.result ?? part.output,
          };
        default:
          return { type: 'text', text: part.text ?? '' };
      }
    });

    const content = parts
      .filter((p): p is MessagePart & { type: 'text' } => p.type === 'text')
      .map((p) => p.text)
      .join('');

    return {
      id: message.id,
      role: message.role,
      content,
      parts,
    };
  });

  // Set messages with type conversion
  const setMessages = useCallback(
    (newMessages: UIMessage[]) => {
      aiSetMessages(
        newMessages.map((message) => ({
          id: message.id,
          role: message.role,
          parts: message.parts?.map((part) => {
            if (part.type === 'text') return { type: 'text', text: part.text };
            if (part.type === 'reasoning') return { type: 'reasoning', reasoning: part.reasoning };
            return part;
          }) ?? [{ type: 'text', text: message.content }],
        })) as unknown as Parameters<typeof aiSetMessages>[0]
      );
    },
    [aiSetMessages]
  );

  return {
    // Messages
    messages: uiMessages,
    setMessages,

    // Input
    input,
    setInput,
    handleInputChange,

    // Actions
    handleSubmit,
    sendMessage,
    stop,
    reload,
    reset,

    // Status
    status,
    isLoading,
    isStreaming,
    error: error ?? null,

    // Conversation
    conversationId,
  };
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook pre-configurato per Copilot (floating panel).
 */
export function useCopilot(options: Omit<UseCoachChatOptions, 'api'> = {}) {
  return useCoachChat({
    ...options,
    api: '/api/chat',
    body: {
      ...options.body,
      tier: 'balanced',
      reasoning: true,
    },
  });
}

/**
 * Hook pre-configurato per Chat principale (full screen).
 */
export function useMainChat(options: Omit<UseCoachChatOptions, 'api'> = {}) {
  return useCoachChat({
    ...options,
    api: '/api/chat',
  });
}
