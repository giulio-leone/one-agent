/**
 * @onecoach/one-agent/chat/client
 *
 * Client-side chat hooks and components.
 * TODO: Implement full chat hooks with AI SDK integration.
 */

'use client';

import type { ReactNode } from 'react';

// ── Types ──

export interface UseUnifiedChatOptions {
  conversationId?: string;
  modelId?: string;
  domain?: string;
  systemPrompt?: string;
  onFinish?: () => void;
  [key: string]: unknown;
}

export interface UseChatCoreOptions {
  conversationId?: string;
  modelId?: string;
  api?: string;
  onFinish?: () => void;
  [key: string]: unknown;
}

export interface UnifiedChatProps {
  mode?: 'fullscreen' | 'sidebar';
  domain?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

// ── Hooks ──

/**
 * useUnifiedChat - primary chat hook for the web app.
 * TODO: Implement with AI SDK useChat integration.
 */
export function useUnifiedChat(_options: UseUnifiedChatOptions = {}): Record<string, unknown> {
  return {
    messages: [],
    input: '',
    setInput: () => {},
    handleSubmit: () => {},
    isLoading: false,
    error: null,
    append: async () => {},
    reload: async () => {},
    stop: () => {},
  };
}

/**
 * useChatCore - shared chat core hook (cross-platform).
 * TODO: Implement with AI SDK integration.
 */
export function useChatCore(_options: UseChatCoreOptions = {}): Record<string, unknown> {
  return {
    messages: [],
    input: '',
    setInput: () => {},
    handleSubmit: () => {},
    isLoading: false,
    error: null,
    append: async () => {},
    reload: async () => {},
    stop: () => {},
  };
}

/**
 * useOneAgendaCopilotSync - syncs agenda state with copilot context.
 * TODO: Implement with OneAgenda integration.
 */
export function useOneAgendaCopilotSync(): void {
  // no-op stub
}

/**
 * useOneAgendaCopilotRealtimeSync - realtime sync for agenda copilot.
 * TODO: Implement with OneAgenda realtime integration.
 */
export function useOneAgendaCopilotRealtimeSync(): void {
  // no-op stub
}

/**
 * UnifiedChat - pre-built chat component.
 * TODO: Implement full chat UI component.
 */
export function UnifiedChat(_props: UnifiedChatProps): null {
  return null;
}
