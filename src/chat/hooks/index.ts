/**
 * Chat Core Hooks
 *
 * Export centralizzato di tutti gli hooks.
 */

'use client';

export { useChatCore, useCopilotChatCore, useMainChatCore } from './use-chat-core';

export {
  useChatRealtime,
  useChatConversationsRealtime,
  useChatWithRealtime,
} from './use-chat-realtime';

export { useUnifiedChat } from './use-unified-chat';

// Copilot Sync - Domain agnostic store subscription
export {
  useCopilotSync,
  useWorkoutCopilotSync,
  useNutritionCopilotSync,
  useOneAgendaCopilotSync,
  type UseCopilotSyncConfig,
} from './use-copilot-refresh';

// Copilot Realtime Sync - Supabase Realtime → Copilot Context
export {
  useCopilotRealtimeSync,
  useWorkoutCopilotRealtimeSync,
  useNutritionCopilotRealtimeSync,
  useOneAgendaCopilotRealtimeSync,
  type UseCopilotRealtimeSyncConfig,
} from './use-copilot-realtime-sync';
