/**
 * lib-chat-core
 *
 * Core condiviso per Chat e Copilot.
 * SSOT (Single Source of Truth) per tutti i componenti e hook chat-related.
 *
 * PRINCIPI:
 * - KISS: API semplice e intuitiva
 * - SOLID: Separation of Concerns chiara
 * - DRY: Nessuna duplicazione tra Chat e Copilot
 *
 * ARCHITETTURA:
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    lib-chat-core                            │
 * │                                                             │
 * │  ┌───────────────────────────────────────────────────────┐ │
 * │  │  TYPES                                                 │ │
 * │  │  - ChatMessage, ChatConversation, ChatStatus          │ │
 * │  │  - UseChatCoreOptions, MessageBubbleProps             │ │
 * │  │  - UnifiedChatProps, ScreenContextData                │ │
 * │  └───────────────────────────────────────────────────────┘ │
 * │                                                             │
 * │  ┌───────────────────────────────────────────────────────┐ │
 * │  │  PROVIDERS                                             │ │
 * │  │  - UnifiedChatProvider (global context)               │ │
 * │  └───────────────────────────────────────────────────────┘ │
 * │                                                             │
 * │  ┌───────────────────────────────────────────────────────┐ │
 * │  │  HOOKS                                                 │ │
 * │  │  - useChatCore (AI SDK v6 wrapper)                    │ │
 * │  │  - useUnifiedChat (Chat + Copilot unified)            │ │
 * │  │  - useChatRealtime (Supabase Realtime)                │ │
 * │  └───────────────────────────────────────────────────────┘ │
 * │                                                             │
 * │  ┌───────────────────────────────────────────────────────┐ │
 * │  │  COMPONENTS                                            │ │
 * │  │  - MessageBubble (markdown, syntax highlight)         │ │
 * │  │  - ChatInput (auto-resize, keyboard)                  │ │
 * │  │  - ConversationList (selection, delete)               │ │
 * │  │  - UnifiedChat (fullscreen/sidebar/floating)          │ │
 * │  └───────────────────────────────────────────────────────┘ │
 * │                                                             │
 * │  ┌───────────────────────────────────────────────────────┐ │
 * │  │  UTILS                                                 │ │
 * │  │  - Message conversion (AI SDK v6 ↔ ChatMessage)       │ │
 * │  │  - Message helpers (create, filter, sort)             │ │
 * │  └───────────────────────────────────────────────────────┘ │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * @example
 * ```tsx
 * // Chat unificata (fullscreen)
 * import { useUnifiedChat, UnifiedChatProvider } from '@giulio-leone/lib-chat-core';
 *
 * function Chat() {
 *   const { messages, sendMessage, status } = useUnifiedChat({ mode: 'fullscreen' });
 *   // ...
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Copilot sidebar con contesto
 * import { useUnifiedChat } from '@giulio-leone/lib-chat-core';
 *
 * function Copilot({ workoutId }) {
 *   const { messages, sendMessage } = useUnifiedChat({
 *     mode: 'sidebar',
 *     contextOverride: { type: 'workout', entityId: workoutId }
 *   });
 *   // ...
 * }
 * ```
 */

// Server-safe exports only.
// Client-only hooks/components/providers are available via `@giulio-leone/lib-chat-core/client`.
export * from './types';
export * from './utils';
export * from './conversation.service';

// Chat agent & hooks
export * from './agent';
export {
  type AISDKMessagePart,
  type AISDKMessage,
  type ChatRequestMessage,
  type LegacyMessage,
  type UseCoachChatOptions,
  type CoachChatResult,
  type ChatRequestBody,
  type ChatResponseHeaders,
} from './types/chat-agent';
export * from './hooks/use-chat';
