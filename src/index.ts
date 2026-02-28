/**
 * OneAgent SDK 4.2
 *
 * AI Agent framework published as @giulio-leone/one-agent.
 * Durable streaming, skill visibility, and weighted progress.
 * Following KISS, DRY, and SOLID principles.
 *
 * @packageDocumentation
 */

// Version (single source of truth)
export { SDK_VERSION } from './core/version';
export { SDK_VERSION as VERSION } from './core/version';

// Core
export * from './core/types';
export * from './core/type-helpers';
export * from './core/BaseAgent';
export * from './core/CostCalculator';

// Re-export core AI types
export { z } from 'zod';
export type { LanguageModel, UIMessage } from 'ai';

// Adapters
export * from './adapters/VercelAIProvider';

// Schemas
export * from './schemas/nutrition.schema';
export * from './schemas/workout.schema';

// Mesh
export * from './mesh/types';

export * from './mesh/PerformanceMonitor';
export * from './mesh/SimpleCache';

// Copilot Agent (usa ChatAgent per i flussi moderni)
export * from './agents/copilot';

// Chat Agent (AI SDK v6 ToolLoopAgent)
export * from './agents/chat';

// Agent Registry
export * from './registry';

// Utils
export * from './utils/ai-agent-setup';

// Hooks (merged from @giulio-leone/one-agent-hooks)
export * from './hooks';

// Copilot services (merged from lib-copilot)
export * from './copilot';

// Explicit re-exports to resolve ambiguity from duplicate export * statements
export { MacrosSchema } from './schemas/nutrition.schema';
export { SetGroupSchema } from './schemas/workout.schema';
