/**
 * OneAgent SDK v4.2 - Public API
 *
 * Fractal Agent Architecture with MCP Integration
 * v4.0: Added DurableAgent support via WDK
 * v4.1: Added streaming progress via getWritable() and AI-driven updates
 * v4.2: Added skill visibility, weighted progress, and abstracted workout patterns
 *
 * @example
 * import { execute, createMesh } from './framework';
 *
 * // Simple execution
 * const result = await execute('domains/workout/agents/exercise-selection', input);
 *
 * // Mesh orchestration
 * const mesh = createMesh({
 *   basePath: './domains/workout',
 *   agents: ['agents/exercise-selection', 'agents/workout-planning']
 * });
 * const result = await mesh.run('agents/workout-coordinator', input);
 *
 * // Durable execution with streaming (v4.1)
 * // Use createAgentDurableResponse() in API routes for SSE streaming
 * import { createAgentDurableResponse } from '@giulio-leone/one-agent/api';
 */

// ==================== ENGINE ====================
export { execute, executeNode, createContext, createMesh } from './engine';
export type { MeshConfig } from './engine';

// ==================== WORKER ====================
export { executeWorker, buildSystemPrompt } from './worker';

// ==================== DURABLE (v4.0) ====================
export { executeDurable, getDurableWorkflowStatus, cancelDurableWorkflow } from './durable';

// ==================== WDK WORLD (v4.0) ====================
export { initializeWDKWorld, isWDKWorldAvailable, getWDKWorldStatus } from './wdk-world';

// ==================== WORKFLOW ====================
export { executeWorkflow } from './workflow';

// ==================== LOADER ====================
export {
  loadAgentManifest,
  loadSkills,
  loadAgentJsonConfig,
  loadAgentSkills,
  isManager,
  discoverAgents,
} from './loader';

// ==================== PARSER ====================
export { parseWorkflow, hasWorkflow } from './parser';

// ==================== RESOLVER ====================
export {
  resolveTemplate,
  resolvePath,
  resolveInputMap,
  setContextValue,
  evaluateCondition,
  cloneContext,
} from './resolver';

// ==================== MCP ====================
export {
  connectToMCPServers,
  mcpToolsToAiSdk,
  disconnectAllMCPServers,
  disconnectMCPServer,
} from './mcp';

// ==================== PERSISTENCE ====================
export { createPrismaAdapter, createInMemoryAdapter } from './persistence';

// ==================== SCHEMA REGISTRY ====================
export {
  registerSchemas,
  getSchema,
  hasAgentSchemas,
  getRegisteredSchemaKeys,
  clearSchemaRegistry,
  // Tools registry
  registerTools,
  getAgentTools,
  getRegisteredToolKeys,
  clearToolsRegistry,
  // Transform registry
  registerTransforms,
  getTransform,
  getRegisteredTransformKeys,
  clearTransformRegistry,
  clearAllRegistries,
} from './registry';

// ==================== TYPES ====================
export type {
  // Context
  Context,
  ChatMessage,
  ExecutionMeta,
  ExecutionStatus,

  // Agent
  AgentManifest,
  AgentJsonConfig,
  AgentConfig,
  MCPServerConfig,
  ExecutionMode,

  // Agent v4.2 (skills/tools/progress config)
  AgentSkillsConfig,
  AgentToolsConfig,
  AgentProgressConfig,
  AgentProgressStep,

  // Durability (v4.0)
  DurabilityConfig,
  DurableExecutionResult,
  DurableExecuteOptions,
  WorkflowRunStatus,
  WorkflowEvent,

  // Workflow
  WorkflowDef,
  WorkflowStep,
  CallStep,
  ParallelStep,
  LoopStep,
  ConditionalStep,
  TransformStep,
  TransformFunction,
  InputValue,
  RetryConfig,

  // Progress
  ProgressEvent,
  ProgressCallback,

  // Progress v4.1 (AI-driven)
  ProgressField,
  UIProgressEvent,

  // MCP
  MCPTool,

  // Persistence
  PersistenceAdapter,
  MemoryEntry,

  // Result
  ExecutionResult,
} from './types';

export {
  DEFAULT_AGENT_CONFIG,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_DURABILITY_CONFIG,
  AGENT_TIMEOUT_PRESETS,
  // v4.1: Progress schema and instructions
  ProgressFieldSchema,
  PROGRESS_PROMPT_INSTRUCTIONS,
  // v4.2: OAuth providers
  OAUTH_PROVIDERS,
} from './types';

export type { AgentTimeoutPreset, OAuthProvider } from './types';

// ==================== SDK 4.0 PRESETS ====================
export {
  DURABILITY_PRESETS,
  AGENT_CONFIG_PRESETS,
  WORKFLOW_TYPES,
  resolveDurabilityPreset,
  createDurableAgentConfig,
} from './sdk4-presets';

export type { DurabilityPreset, AgentConfigPreset, WorkflowType } from './sdk4-presets';

// ==================== API HELPERS (v4.1) ====================
export { createAgentDurableResponse, createAgentStreamResponse, createProgressEvent } from './api';

export type { CreateAgentDurableResponseParams } from './api';

// ==================== AGENT WORKFLOW (v4.1) ====================
export { agentWorkflow } from './agent-workflow';
export type { AgentWorkflowParams, AgentWorkflowResult } from './agent-workflow';
