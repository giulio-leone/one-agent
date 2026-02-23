/**
 * OneAgent Hooks - Type Definitions
 *
 * Types for client-side streaming and progress tracking.
 * Compatible with AI SDK v6 UIMessageChunk format.
 *
 * @package @giulio-leone/one-agent/hooks
 * @version 0.1.0
 */

/**
 * Progress field populated by AI during execution.
 * This is the client-side representation of ProgressFieldSchema.
 */
export interface ProgressField {
  /** Internal step identifier (e.g., "tool:searchFlights") */
  step: string;
  /** User-friendly message in user's language */
  userMessage: string;
  /** Technical details for admin/debug view */
  adminDetails?: string;
  /** Estimated progress percentage (0-100) */
  estimatedProgress: number;
  /** Icon hint for UI rendering */
  iconHint?: 'search' | 'analyze' | 'compare' | 'filter' | 'loading' | 'success' | 'error';
  /** Tool name if this is a tool-related event */
  toolName?: string;
}

/**
 * Agent event types for streaming
 */
export type AgentEventType =
  | 'agent_start'
  | 'step_start'
  | 'step_complete'
  | 'tool_call'
  | 'tool_result'
  | 'ai_progress'
  | 'partial_output'
  | 'agent_complete'
  | 'error';

/**
 * Agent event received from SSE stream
 */
export interface AgentEvent {
  type: AgentEventType;
  timestamp: Date;
  data: ProgressField;
}

/**
 * State managed by useAgentStream hook
 */
export interface AgentStreamState<TOutput> {
  /** Current streaming status */
  status: 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';
  /** Current progress percentage (0-100) */
  progress: number;
  /** Current step identifier */
  currentStep: string;
  /** User-friendly message for current action */
  userMessage: string;
  /** All events received during streaming */
  events: ProgressField[];
  /** Final result when complete */
  result: TOutput | null;
  /** Error message if failed */
  error: string | null;
  /** Workflow run ID for resume capability */
  runId: string | null;
}

/**
 * Options for useAgentStream hook
 */
export interface UseAgentStreamOptions {
  /** Include admin details in events (for debugging) */
  adminMode?: boolean;
  /** Maximum number of events to keep in state (default: 50) */
  maxEvents?: number;
  /** Auto-retry on connection failure */
  autoRetry?: boolean;
  /** Max retry attempts (default: 3) */
  maxRetries?: number;
}

/**
 * Return type of useAgentStream hook
 */
export interface UseAgentStreamReturn<TOutput, TInput> extends AgentStreamState<TOutput> {
  /** Execute the agent with input */
  execute: (input: TInput) => Promise<void>;
  /** Abort current execution */
  abort: () => void;
  /** Reset state to initial */
  reset: () => void;
  /** Whether currently loading (connecting or streaming) */
  isLoading: boolean;
  /** Latest event received */
  latestEvent: ProgressField | null;
}

/**
 * Admin mode state
 */
export interface AdminModeState {
  /** Whether admin mode is enabled */
  isAdmin: boolean;
  /** Toggle admin mode */
  toggle: () => void;
  /** Enable admin mode */
  enable: () => void;
  /** Disable admin mode */
  disable: () => void;
}
