/**
 * OneAgent SDK v4.2 - Core Types
 *
 * Fractal Architecture: Manager/Worker based on WORKFLOW.md presence
 * MCP Integration for tools
 * DurableAgent support via WDK
 * Real-time streaming via getWritable()
 *
 * @since v4.0 - Added 'durable' execution mode
 * @since v4.1 - Added ProgressFieldSchema for AI-driven progress updates
 * @since v4.2 - Added AgentSkillsConfig, AgentToolsConfig, AgentProgressConfig, step weights
 */

import { z } from 'zod';
import type { ModelTier, ProviderName } from '@giulio-leone/types-ai';

// Re-export for use in other modules
export type { ModelTier, ProviderName };

// ==================== CONTEXT (Shared Data Bus) ====================

/**
 * Execution context - the shared data bus for all agents
 */
export interface Context {
  /** Unique execution ID */
  executionId: string;

  /** User who initiated the execution */
  userId: string;

  /** Base path for resolving relative agent paths */
  basePath?: string;

  /** Initial input (read-only) */
  readonly input: unknown;

  /** Persistent structured store (survives across steps) */
  artifacts: Record<string, unknown>;

  /** Ephemeral working memory (cleared after each step) */
  memory: ChatMessage[];

  /** Execution metadata */
  meta: ExecutionMeta;

  /** Progress callback for real-time updates (optional) */
  onProgress?: ProgressCallback;
}

/**
 * Chat message for working memory
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
}

/**
 * Execution metadata for tracking
 */
export interface ExecutionMeta {
  startedAt: Date;
  updatedAt: Date;
  currentStep: string;
  tokensUsed: number;
  costUSD: number;
  status: ExecutionStatus;
  error?: string;
}

export type ExecutionStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

// ==================== PROGRESS CALLBACK ====================

/**
 * Progress event emitted during execution
 * Used for real-time UI updates via streaming
 */
export interface ProgressEvent {
  /** Current step/agent being executed */
  step: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Human-readable status message */
  message: string;
  /** Additional metadata */
  data?: Record<string, unknown>;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Callback for receiving progress updates during execution
 * Compatible with AI SDK v6 data parts for streaming
 */
export type ProgressCallback = (event: ProgressEvent) => void;

// ==================== AI-DRIVEN PROGRESS (v4.1) ====================

/**
 * Standard progress field schema for AI-driven feedback.
 *
 * Include this in agent output schemas as an optional `_progress` field.
 * The AI will populate this before each major action, providing real-time
 * updates to the UI in the user's language.
 *
 * @since v4.1
 *
 * @example
 * ```typescript
 * const MyAgentOutputSchema = z.object({
 *   // Your output fields...
 *   result: z.string(),
 *
 *   // AI-driven progress (optional, transient)
 *   _progress: ProgressFieldSchema.optional(),
 * });
 * ```
 */
export const ProgressFieldSchema = z.object({
  /** Internal step identifier (e.g., "init", "tool:searchFlights", "analysis") */
  step: z
    .string()
    .describe(
      'Internal step name for tracking. Examples: "init", "tool:searchFlights", "analysis", "finalizing"'
    ),

  /** User-friendly message in user's language - AI generates this contextually */
  userMessage: z
    .string()
    .describe(
      'User-friendly progress message, max 60 chars. Must be in the same language as user input. ' +
        'Should be encouraging and informative. Examples: "Searching best prices...", "Analyzing options..."'
    ),

  /** Technical details for admin/debug view */
  adminDetails: z
    .string()
    .optional()
    .describe(
      'Technical details for debugging. Include API calls, parameters, timing. ' +
        'Example: "Kiwi API: FCO→CDG, 2025-01-15, found 23 results"'
    ),

  /** Estimated progress percentage */
  estimatedProgress: z
    .number()
    .min(0)
    .max(100)
    .describe('Estimated overall progress as percentage (0-100)'),

  /** Icon hint for UI rendering */
  iconHint: z
    .enum(['search', 'analyze', 'compare', 'filter', 'loading', 'success', 'error'])
    .optional()
    .describe('Icon hint for the UI to display appropriate icon'),

  /** Tool name if this is a tool-related event */
  toolName: z.string().optional().describe('Name of the tool being called, if applicable'),
});

/** TypeScript type for ProgressFieldSchema */
export type ProgressField = z.infer<typeof ProgressFieldSchema>;

/**
 * UI Progress Event - what gets written to WDK getWritable() stream.
 * Compatible with AI SDK v6 UIMessageChunk format.
 *
 * @since v4.1
 */
export interface UIProgressEvent {
  /** Event type - 'data-progress' for AI SDK compatibility */
  type: 'data-progress';
  /** Progress data from AI's _progress field */
  data: ProgressField;
  /** Transient events are not persisted in message history */
  transient: true;
  /** Optional ID for correlation */
  id?: string;
}

/**
 * Progress instructions to inject into system prompt.
 * This guides the AI to emit _progress updates before each major action.
 *
 * @since v4.1
 */
export const PROGRESS_PROMPT_INSTRUCTIONS = `
## Real-Time Progress Updates

You MUST emit progress updates by including the "_progress" field in your output BEFORE each major action.
This is REQUIRED for all worker agents and provides real-time feedback to users during execution.

### Progress Field Structure:
- step: Internal identifier (e.g., "init", "tool:searchFlights", "analysis")
- userMessage: User-friendly message in the SAME LANGUAGE as user input (max 60 chars)
- adminDetails: Technical details for debugging (optional)
- estimatedProgress: Overall progress percentage (0-100)
- iconHint: Icon suggestion ("search", "analyze", "compare", "filter", "loading", "success", "error")
- toolName: Name of tool being called (if applicable)

### Guidelines:
1. Emit progress BEFORE calling each tool
2. The userMessage must be in the user's language (auto-detect from input)
3. Keep userMessage concise, encouraging, and action-oriented
4. Use appropriate iconHint for visual feedback
5. Update estimatedProgress realistically (don't jump from 10% to 90%)

### Example Progress Sequence:
\`\`\`
10%: { step: "init", userMessage: "Starting search...", iconHint: "loading" }
25%: { step: "tool:searchFlights", userMessage: "Searching available flights...", iconHint: "search", toolName: "searchFlights" }
50%: { step: "analysis", userMessage: "Analyzing best options...", iconHint: "analyze" }
75%: { step: "comparison", userMessage: "Comparing prices...", iconHint: "compare" }
90%: { step: "finalizing", userMessage: "Preparing recommendations...", iconHint: "loading" }
\`\`\`
`;

// ==================== AGENT MANIFEST ====================

/**
 * Agent Skills configuration (agent.json)
 */
export interface AgentSkillsConfig {
  /** Relative path to skills directory (default: "skills") */
  path?: string;
  /** Whether parent agents can see these skills (default: false) */
  expose?: boolean;
}

/**
 * Agent Tools configuration (agent.json)
 */
export interface AgentToolsConfig {
  /** Relative path to tools directory (default: "tools") */
  path?: string;
  /** Whether parent agents can see these tools (default: false) */
  expose?: boolean;
}

/**
 * Optional progress step definition for fallback progress
 */
export interface AgentProgressStep {
  name: string;
  weight: number;
}

/**
 * Agent progress configuration (agent.json)
 */
export interface AgentProgressConfig {
  /** Weight used for workflow progress distribution (default: 1) */
  weight?: number;
  /** Whether AI-driven _progress is required (default: true) */
  aiDriven?: boolean;
  /** Optional fallback steps if AI progress is unavailable */
  fallbackSteps?: AgentProgressStep[];
}

/**
 * Agent Manifest - loaded from agent.json + AGENTS.md + schema.ts
 */
export interface AgentManifest {
  /** Unique identifier */
  id: string;

  /** Version */
  version: string;

  /** Agent type */
  type: 'agent';

  /** Directory path */
  path: string;

  /** Interface contract */
  interface: {
    input: z.ZodSchema;
    output: z.ZodSchema;
  };

  /** System prompt (loaded from AGENTS.md) */
  systemPrompt: string;

  /** Workflow definition (parsed from WORKFLOW.md if present) */
  workflow?: WorkflowDef;

  /** MCP server configurations */
  mcpServers?: Record<string, MCPServerConfig>;

  /** Agent skills configuration */
  skills?: AgentSkillsConfig;

  /** Agent tools configuration */
  tools?: AgentToolsConfig;

  /** Agent progress configuration */
  progress?: AgentProgressConfig;

  /** Agent config */
  config: AgentConfig;
}

/**
 * Agent.json raw structure
 */
export interface AgentJsonConfig {
  id: string;
  version: string;
  type: 'agent';
  interface: {
    input: { $ref: string };
    output: { $ref: string };
  };
  mcpServers?: Record<string, MCPServerConfig>;
  skills?: AgentSkillsConfig;
  tools?: AgentToolsConfig;
  progress?: AgentProgressConfig;
  config?: Partial<AgentConfig>;
}

/**
 * MCP Server configuration
 * Supports both stdio (command) and HTTP/SSE (url) transports.
 * Auto-detection: if 'url' is present, uses HTTP/SSE; otherwise uses stdio.
 */
export interface MCPServerConfig {
  /** Command to spawn MCP server (stdio transport) */
  command?: string;
  /** Arguments for the command */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** URL for HTTP/SSE transport (auto-detected if present) */
  url?: string;
}

/**
 * Execution mode for agent
 * - 'stream': Use streaming for real-time UI (textStream, partialOutputStream)
 * - 'generate': Use generate for batch processing (full result at once)
 * - 'durable': Use DurableAgent with WDK for resumable execution (v4.0+)
 */
export type ExecutionMode = 'stream' | 'generate' | 'durable';

/**
 * Agent execution config
 */
export interface AgentConfig {
  /** Model tier for automatic selection (preferred over explicit model) */
  tier?: ModelTier;
  /** Explicit model override (use 'auto' for tier-based selection) */
  model?: string;
  /** Explicit provider override (auto-detected from model if not set) */
  provider?: ProviderName;
  temperature: number;
  maxSteps: number;
  maxTokens: number;
  timeout: number;
  /** Execution mode: 'stream' for real-time UI, 'generate' for batch, 'durable' for WDK */
  executionMode: ExecutionMode;
  /**
   * Skip AI synthesis after workflow completion for Manager agents.
   * When true, the engine uses outputArtifact directly as the final output.
   */
  skipSynthesis?: boolean;
  /**
   * Artifact key to use as output when skipSynthesis=true.
   * Supports dot notation for nested access (e.g., "finalProgram.program").
   * Default: "_output"
   */
  outputArtifact?: string;
  /**
   * Durability configuration (only used when executionMode = 'durable')
   * @since v4.0
   */
  durability?: DurabilityConfig;
}

/**
 * Configuration for durable execution mode
 * Controls WDK integration behavior
 * @since v4.0
 */
export interface DurabilityConfig {
  /** Enable WDK integration (default: true when executionMode='durable') */
  enabled?: boolean;

  /** Maximum timeout for entire workflow in ms (default: 600000 = 10min) */
  maxDurationMs?: number;

  /** Retry configuration for failed steps */
  retry?: {
    /** Maximum number of retry attempts (default: 3) */
    maxAttempts: number;
    /** Initial delay between retries in ms (default: 1000) */
    backoffMs: number;
    /** Exponential backoff multiplier (default: 2) */
    backoffMultiplier: number;
  };

  /**
   * Checkpoint strategy
   * - 'step': Checkpoint after each workflow step (default)
   * - 'tool': Checkpoint after each tool call
   * - 'both': Checkpoint on both step and tool boundaries
   */
  checkpointStrategy?: 'step' | 'tool' | 'both';
}

/**
 * Default agent configuration
 *
 * @note temperature=1 for creative, diverse outputs (user requirement)
 * @note timeout is conservative - override per agent type using AGENT_TIMEOUT_PRESETS
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  tier: 'balanced', // Use tier system, not hardcoded model
  temperature: 1, // Full creativity for diverse, non-repetitive outputs
  maxSteps: 5,
  maxTokens: 4096,
  timeout: 120_000, // 2 minutes default (conservative baseline)
  executionMode: 'stream',
};

/**
 * Timeout presets by agent complexity (DRY - use these instead of hardcoding)
 *
 * @example
 * ```typescript
 * config: {
 *   ...DEFAULT_AGENT_CONFIG,
 *   timeout: AGENT_TIMEOUT_PRESETS.complex,
 * }
 * ```
 */
export const AGENT_TIMEOUT_PRESETS = {
  /** Quick operations: validation, parsing, simple transforms (30s) */
  fast: 30_000,
  /** Standard agents: single-step generation (2 min) */
  standard: 120_000,
  /** Complex agents: multi-step workflows, orchestrators (5 min) */
  complex: 300_000,
  /** Long-running: full plan generation, large context (10 min) */
  extended: 600_000,
  /** Maximum: durable workflows with many steps (30 min) */
  maximum: 1_800_000,
} as const;

export type AgentTimeoutPreset = keyof typeof AGENT_TIMEOUT_PRESETS;

/**
 * Default durability configuration
 * @since v4.0
 */
export const DEFAULT_DURABILITY_CONFIG: DurabilityConfig = {
  enabled: true,
  maxDurationMs: 600_000, // 10 minutes
  retry: {
    maxAttempts: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
  },
  checkpointStrategy: 'step',
};

// ==================== OAUTH PROVIDERS ====================

/**
 * Providers that use OAuth instead of API keys.
 * These don't require explicit API key configuration.
 * @since v4.2
 */
export const OAUTH_PROVIDERS = ['gemini-cli'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

// ==================== WORKFLOW DEFINITION ====================

/**
 * Workflow definition - parsed from WORKFLOW.md
 */
export interface WorkflowDef {
  steps: WorkflowStep[];
}

/**
 * Workflow step types
 */
export type WorkflowStep = CallStep | ParallelStep | LoopStep | ConditionalStep | TransformStep;

/**
 * Input value types for workflow steps
 * - string: Template like "${input.goals}" or literal string
 * - number/boolean: Literal values
 * - object/array: Complex values (rare, usually from previous step output)
 */
export type InputValue = string | number | boolean | unknown[] | Record<string, unknown>;

/**
 * Retry configuration for workflow steps
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 1 = no retry) */
  maxAttempts: number;
  /** Delay between retries in ms (default: 1000) */
  delayMs?: number;
  /** Exponential backoff multiplier (default: 1 = no backoff) */
  backoffMultiplier?: number;
  /** What to do on final failure: 'abort' stops workflow, 'continue' proceeds with null */
  onFailure: 'abort' | 'continue';
  /** Optional fallback store key if using 'continue' */
  fallbackStore?: string;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 1,
  delayMs: 1000,
  backoffMultiplier: 1,
  onFailure: 'abort',
};

/**
 * Call a sub-agent
 */
export interface CallStep {
  type: 'call';
  name: string;
  agentId: string;
  /** Input map with type-preserving values */
  inputMap: Record<string, InputValue>;
  storeKey: string;
  /** Optional weight for structural progress distribution */
  weight?: number;
  /** Optional retry configuration */
  retry?: RetryConfig;
}

/**
 * Execute branches in parallel
 */
export interface ParallelStep {
  type: 'parallel';
  name: string;
  branches: WorkflowStep[][];
  /** Optional weight for structural progress distribution */
  weight?: number;
}

/**
 * Loop over an array (map-reduce pattern)
 */
export interface LoopStep {
  type: 'loop';
  name: string;
  /** Array to iterate over - can be template string or literal array */
  over: string | unknown[];
  itemVar: string;
  mode: 'parallel' | 'sequential';
  steps: WorkflowStep[];
  outputKey: string;
  /** Optional weight for structural progress distribution */
  weight?: number;
}

/**
 * Conditional execution
 */
export interface ConditionalStep {
  type: 'conditional';
  name: string;
  condition: string;
  then: WorkflowStep[];
  else?: WorkflowStep[];
  /** Optional weight for structural progress distribution */
  weight?: number;
}

/**
 * Transform step - calls a registered TypeScript function
 *
 * Use for programmatic operations that should NOT be done by AI:
 * - Cloning/patching data structures
 * - Complex calculations
 * - Data validation and normalization
 *
 * @example
 * ```yaml
 * transform: assembleWeeksFromDiffs
 * input:
 *   week1: ${artifacts.week1Template}
 *   diffs: ${artifacts.progressionDiffs}
 *   durationWeeks: ${input.goals.duration}
 * store: assembledWeeks
 * ```
 */
export interface TransformStep {
  type: 'transform';
  name: string;
  /** Registry key for the transform function */
  transformId: string;
  /** Input map with type-preserving values */
  inputMap: Record<string, InputValue>;
  /** Key to store the result in artifacts */
  storeKey: string;
  /** Optional weight for structural progress distribution */
  weight?: number;
}

/**
 * Transform function signature
 * Takes resolved input and returns output to store in artifacts
 */
export type TransformFunction = (input: Record<string, unknown>) => unknown | Promise<unknown>;

// ==================== MCP TYPES ====================

/**
 * MCP Tool definition (mapped from MCP server)
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: unknown) => Promise<unknown>;
}

// ==================== PERSISTENCE ====================

/**
 * Persistence adapter interface
 */
export interface PersistenceAdapter {
  createContext(data: Omit<Context, 'executionId' | 'meta'>): Promise<Context>;
  loadContext(executionId: string): Promise<Context | null>;
  saveContext(context: Context): Promise<void>;
  loadMemory(userId: string, domain: string, limit?: number): Promise<MemoryEntry[]>;
  saveMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): Promise<MemoryEntry>;
  summarizeMemory(userId: string, agentId: string): Promise<void>;
}

/**
 * Memory entry for long-term storage
 */
export interface MemoryEntry {
  id: string;
  userId: string;
  agentId: string;
  domain: string;
  type: 'episodic' | 'semantic' | 'procedural';
  content: string;
  data?: Record<string, unknown>;
  importance: number;
  summary?: string;
  createdAt: Date;
}

// ==================== ENGINE RESULT ====================

/**
 * Execution result
 */
export interface ExecutionResult<T = unknown> {
  success: boolean;
  output?: T;
  error?: {
    message: string;
    code: string;
    recoverable: boolean;
  };
  meta: {
    executionId: string;
    duration: number;
    tokensUsed: number;
    costUSD: number;
  };
}

/**
 * Extended execution result for durable mode
 * Includes workflowRunId for resume/poll capability
 * @since v4.0
 */
export interface DurableExecutionResult<T = unknown> extends ExecutionResult<T> {
  /** WDK workflow run ID - use for polling status or resume */
  workflowRunId?: string;
  /** Workflow status at time of return */
  workflowStatus?: WorkflowRunStatus;
}

/**
 * Workflow run status from WDK
 * @since v4.0
 */
export type WorkflowRunStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Options for durable execution
 * @since v4.0
 */
export interface DurableExecuteOptions {
  /** Resume from existing workflow run ID instead of starting new */
  resumeFromRunId?: string;
  /** Additional tools to include */
  additionalTools?: Record<string, unknown>;
  /** Skip MCP tool loading */
  skipMCPTools?: boolean;
  /** Callback for workflow events (checkpoints, errors) */
  onWorkflowEvent?: (event: WorkflowEvent) => void;
}

/**
 * Workflow event emitted during durable execution
 * @since v4.0
 */
export interface WorkflowEvent {
  type: 'step_start' | 'step_complete' | 'checkpoint' | 'error' | 'complete';
  step?: string;
  data?: unknown;
  timestamp: Date;
}
