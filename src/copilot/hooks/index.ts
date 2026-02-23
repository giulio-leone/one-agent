/**
 * Copilot Hooks
 *
 * React hooks for Copilot context management and MCP tools integration.
 *
 * @module lib-copilot/hooks
 */

export {
  useCopilotRouteSync,
  useCopilotContext,
  default as useRouteSync,
} from './useCopilotRouteSync';

export {
  useCopilotContextReporter,
  default as useContextReporter,
} from './useCopilotContextReporter';

export type {
  WorkoutSelectionPayload,
  NutritionSelectionPayload,
  OneAgendaSelectionPayload,
  SelectionPayload,
  UseCopilotContextReporterResult,
} from './useCopilotContextReporter';

export {
  useGlobalCopilotContext,
  default as useGlobalContext,
} from './useGlobalCopilotContext';

export type { UseGlobalCopilotContextOptions } from './useGlobalCopilotContext';
