/**
 * OneAgent Hooks
 *
 * React hooks and components for OneAgent SDK 4.1 streaming and progress tracking.
 *
 * @package @giulio-leone/one-agent/hooks
 * @version 0.1.0
 */

// Hooks
export { useAgentStream, default as useAgentStreamDefault } from './use-agent-stream';
export { useAdminMode, default as useAdminModeDefault } from './use-admin-mode';

// Components
export { AgentEventList, default as AgentEventListDefault } from './components/agent-event-list';
export type { AgentEventListProps, IconHint } from './components/agent-event-list';

// Types
export type {
  ProgressField,
  AgentEventType,
  AgentEvent,
  AgentStreamState,
  UseAgentStreamOptions,
  UseAgentStreamReturn,
  AdminModeState,
} from './types';
