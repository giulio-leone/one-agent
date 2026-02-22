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
export { SDK_VERSION, SDK_MAJOR, SDK_MINOR } from './core/version';
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
export { MeshAgent } from './mesh/MeshAgent';
export { MeshCoordinator, type CoordinatorConfig } from './mesh/MeshCoordinator';
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
