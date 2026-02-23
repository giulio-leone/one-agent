/**
 * Unified Chat Types
 *
 * Types shared between Chat and Copilot unified system.
 * Follows KISS, SOLID, DRY principles.
 */

import type { ReactNode } from 'react';
import type { UIMessage } from '@ai-sdk/react';
import type { ChatConversation } from './conversation';

// ============================================================================
// Screen Context Types
// ============================================================================

/**
 * Context type for screen-aware chat
 */
export type ScreenContextType =
  | 'nutrition'
  | 'workout'
  | 'chat'
  | 'analytics'
  | 'oneagenda'
  | 'exercise'
  | 'general';

/**
 * Capabilities available for a screen context
 */
export interface ScreenCapabilities {
  canGenerate: boolean;
  canModify: boolean;
  canAnalyze: boolean;
  canChat: boolean;
  canUseCamera: boolean;
  canAccessHealth: boolean;
  suggestedPrompts?: string[];
}

/**
 * Screen context data with entity references
 */
export interface ScreenContextData {
  /** Context type */
  type: ScreenContextType;
  /** Entity ID (workoutId, planId, etc.) */
  entityId?: string;
  /** Entity type for clarity */
  entityType?: 'workout' | 'nutrition_plan' | 'exercise' | 'analytics';
  /** Additional context data */
  data?: Record<string, unknown>;
  /** Capabilities for this screen */
  capabilities?: ScreenCapabilities;
  /** Suggested prompts for this context */
  suggestedPrompts?: string[];
}

// ============================================================================
// Feature Flags Types
// ============================================================================

/**
 * AI Chat feature flags (from admin config)
 */
export interface ChatFeatureFlags {
  modelSelector: boolean;
  speechRecognition: boolean;
  checkpoint: boolean;
  context: boolean;
  conversation: boolean;
  sources: boolean;
  suggestions: boolean;
  task: boolean;
  artifact: boolean;
  webPreview: boolean;
  reasoning: boolean;
  queue: boolean;
  attachments: boolean;
}

/**
 * Default feature flags (all essential features enabled)
 */
export const DEFAULT_CHAT_FEATURES: ChatFeatureFlags = {
  modelSelector: false,
  speechRecognition: false,
  checkpoint: false,
  context: true,
  conversation: true,
  sources: false,
  suggestions: true,
  task: false,
  artifact: false,
  webPreview: false,
  reasoning: false,
  queue: false,
  attachments: true,
};

// ============================================================================
// Model Types
// ============================================================================

/**
 * AI Model configuration
 */
export interface AIModel {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  description?: string | null;
  supportsVision?: boolean;
  supportsTools?: boolean;
}

// ============================================================================
// Message Queue Types
// ============================================================================

/**
 * Queued message waiting to be sent
 */
export interface QueuedMessage {
  id: string;
  text: string;
  createdAt: Date;
  files?: File[];
}

// ============================================================================
// Unified Chat Mode Types
// ============================================================================

/**
 * Display mode for unified chat
 */
export type UnifiedChatMode = 'fullscreen' | 'sidebar' | 'floating';

/**
 * User role for feature access
 */
export type UserRole = 'USER' | 'COACH' | 'ADMIN' | 'SUPER_ADMIN';

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Unified Chat Provider context value
 */
export interface UnifiedChatContextValue {
  // State
  userId: string | null;
  userRole: UserRole;
  userCredits: number;
  features: ChatFeatureFlags;
  models: AIModel[];
  defaultModel: AIModel | null;
  selectedModel: string | null;
  screenContext: ScreenContextData | null;
  isOpen: boolean;

  // Actions
  setSelectedModel: (modelId: string) => void;
  setScreenContext: (context: ScreenContextData | null) => void;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
}

/**
 * Props for UnifiedChatProvider
 */
export interface UnifiedChatProviderProps {
  children: ReactNode;
  userId: string;
  userRole?: UserRole;
  userCredits?: number;
  features?: ChatFeatureFlags;
  models?: AIModel[];
  defaultModel?: AIModel | null;
  initialContext?: ScreenContextData;
}

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Options for useUnifiedChat hook
 */
export interface UseUnifiedChatOptions {
  /** Display mode */
  mode?: UnifiedChatMode;
  /** Override screen context */
  contextOverride?: ScreenContextData;
  /** Conversation ID to load */
  conversationId?: string | null;
  /** Initial conversations list */
  initialConversations?: ChatConversation[];
  /** Callback when context update is needed */
  onContextUpdate?: (data: Record<string, unknown>) => void;
  /** Override reasoning feature (toggle) */
  reasoningEnabled?: boolean;
  /** Initial model ID */
  initialModelId?: string;
}

/**
 * Result from useUnifiedChat hook
 */
export interface UseUnifiedChatResult {
  // Chat state (from useChatCore)
  messages: UIMessage[];
  input: string;
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  isLoading: boolean;
  error: Error | null;

  // Conversation state
  conversations: ChatConversation[];
  currentConversation: string | null;
  isDeleting: boolean;

  // Context state
  screenContext: ScreenContextData | null;
  features: ChatFeatureFlags;
  models: AIModel[];
  selectedModel: string | null;
  userRole: UserRole;
  userCredits: number;

  // UI state
  isOpen: boolean;

  // Message Queue state
  messageQueue: QueuedMessage[];

  // Actions
  sendMessage: (options?: { text?: string }) => Promise<void>;
  setInput: (value: string) => void;
  setSelectedModel: (modelId: string) => void;
  loadConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversations: (ids: string[]) => Promise<void>;
  deleteAllConversations: () => Promise<void>;
  reload: () => Promise<void>;
  stop: () => void;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;

  // Message Queue actions (CRUD)
  addToQueue: (text: string, files?: File[]) => string; // Returns queue item ID
  updateQueuedMessage: (id: string, text: string) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
}

// ============================================================================
// Component Types
// ============================================================================

/**
 * Props for UnifiedChat component
 */
export interface UnifiedChatProps {
  /** Display mode */
  mode: UnifiedChatMode;
  /** Override screen context type */
  contextType?: ScreenContextType;
  /** Override context data */
  contextData?: Record<string, unknown>;
  /** Initial conversations (for fullscreen mode) */
  initialConversations?: ChatConversation[];
  /** Callback when context update is needed */
  onContextUpdate?: (data: Record<string, unknown>) => void;
  /** Controlled open state (for sidebar/floating) */
  isOpen?: boolean;
  /** Toggle callback */
  onToggle?: (open: boolean) => void;
  /** Close callback */
  onClose?: () => void;
  /** Custom className */
  className?: string;
  /** Sidebar width in pixels (default: 420) */
  width?: number;
  /** Minimum sidebar width (default: 320) */
  minWidth?: number;
  /** Maximum sidebar width (default: 600) */
  maxWidth?: number;
  /** Is currently resizing */
  isResizing?: boolean;
  /** Children for resize handle slot */
  resizeHandle?: React.ReactNode;
}

/**
 * Props for UnifiedChatMessages component
 */
export interface UnifiedChatMessagesProps {
  messages: UIMessage[];
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  isLoading: boolean;
  features: ChatFeatureFlags;
  onCopy?: (messageId: string, text: string) => void;
  onRegenerate?: () => void;
  suggestedPrompts?: string[];
  onSuggestionClick?: (prompt: string) => void;
  className?: string;
}

/**
 * Props for UnifiedChatInput component
 */
export interface UnifiedChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: { text: string; files?: unknown[] }) => void;
  isLoading: boolean;
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  features: ChatFeatureFlags;
  onCameraOpen?: (mode: 'label' | 'dish') => void;
  contextType?: ScreenContextType;
  className?: string;
}
