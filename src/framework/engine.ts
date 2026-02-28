/**
 * OneAgent SDK v4.2 - Execution Engine
 *
 * The recursive core of the fractal architecture.
 * Determines if an agent is a Manager (has WORKFLOW.md) or Worker,
 * and orchestrates execution accordingly.
 *
 * v4.2 additions:
 * - Durable execution mode via WDK DurableAgent
 * - Resume from workflowRunId
 */

import { randomUUID } from 'crypto';
import type { z } from 'zod';
import type {
  Context,
  ExecutionResult,
  ExecutionMeta,
  PersistenceAdapter,
  ProgressCallback,
  DurableExecutionResult,
} from './types';
import { loadAgentManifest, isManager } from './loader';
import { executeWorkflow } from './workflow';
import { executeWorker } from './worker';

// ==================== TYPES ====================

interface ExecuteOptions {
  /** User ID for the execution */
  userId?: string;
  /** Existing context to continue from */
  context?: Context;
  /** Base path for resolving agent paths */
  basePath?: string;
  /** Persistence adapter for context/memory storage */
  persistence?: PersistenceAdapter;
  /** Override schemas (use when dynamic import fails in bundlers like Turbopack) */
  schemas?: {
    input?: z.ZodSchema;
    output?: z.ZodSchema;
  };
  /** Callback for real-time progress updates */
  onProgress?: ProgressCallback;
  /**
   * Resume from existing workflow run ID (durable mode only)
   * @since v4.0
   */
  resumeFromRunId?: string;
}

// ==================== PUBLIC API ====================

/**
 * Execute an agent by path
 *
 * This is the main entry point for the framework.
 * It loads the agent manifest and determines execution mode:
 * - Manager: Has WORKFLOW.md, orchestrates sub-agents
 * - Worker: No workflow, executes with LLM + tools
 *
 * @param agentPath - Path to the agent directory
 * @param input - Input data for the agent
 * @param options - Execution options
 */
export async function execute<TOutput = unknown>(
  agentPath: string,
  input: unknown,
  options: ExecuteOptions = {}
): Promise<ExecutionResult<TOutput> | DurableExecutionResult<TOutput>> {
  const startTime = Date.now();

  console.log('[Engine] execute() called (v4.0)');
  console.log('[Engine] agentPath:', agentPath);
  console.log('[Engine] basePath:', options.basePath);
  console.log('[Engine] userId:', options.userId);
  console.log('[Engine] resumeFromRunId:', options.resumeFromRunId);
  console.log('[Engine] agentPath:', agentPath);
  console.log('[Engine] basePath:', options.basePath);
  console.log('[Engine] userId:', options.userId);

  try {
    // 1. Load agent manifest
    console.log('[Engine] Step 1: Loading agent manifest...');
    const manifest = await loadAgentManifest(agentPath, options.basePath);
    console.log('[Engine] Manifest loaded:', manifest.id, 'type:', manifest.type);

    // 2. Validate input against schema
    console.log('[Engine] Step 2: Validating input...');
    const validatedInput = manifest.interface.input.parse(input);
    console.log('[Engine] Input validated successfully');

    // 3. Create or use existing context
    console.log('[Engine] Step 3: Creating context...');
    const context = options.context ?? createContext(validatedInput, options.userId);
    // Set basePath in context for nested agent resolution
    // Use provided basePath or derive from manifest path
    context.basePath = options.basePath ?? manifest.path;
    // Store onProgress callback for propagation
    if (options.onProgress) {
      context.onProgress = options.onProgress;
    }
    console.log('[Engine] Context created:', context.executionId, 'basePath:', context.basePath);

    // 4. Execute based on agent type (and execution mode)
    console.log(
      '[Engine] Step 4: Executing node...',
      'executionMode:',
      manifest.config.executionMode
    );
    const result = await executeNode<TOutput>(
      agentPath,
      validatedInput,
      context,
      options.basePath,
      options.resumeFromRunId
    );
    console.log('[Engine] Node execution complete, success:', result.success);

    return result;
  } catch (error) {
    console.error('[Engine] ❌ execute() exception:', error);
    console.error('[Engine] Error name:', error instanceof Error ? error.name : 'N/A');
    console.error(
      '[Engine] Error message:',
      error instanceof Error ? error.message : String(error)
    );
    console.error('[Engine] Error stack:', error instanceof Error ? error.stack : 'N/A');

    const message = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: {
        message,
        code: 'EXECUTION_ERROR',
        recoverable: false,
      },
      meta: {
        executionId: randomUUID(),
        duration: Date.now() - startTime,
        tokensUsed: 0,
        costUSD: 0,
      },
    };
  }
}

/**
 * Execute a single node in the agent graph
 *
 * This is the recursive function that handles both Manager and Worker agents.
 * Managers delegate to executeWorkflow, Workers delegate to executeWorker.
 * In v4.0, also supports durable execution mode via WDK.
 *
 * @param agentPath - Path to the agent directory
 * @param input - Validated input data
 * @param context - Execution context
 * @param basePath - Base path for resolving relative agent paths
 * @param resumeFromRunId - Optional workflow run ID to resume (durable mode only)
 */
export async function executeNode<TOutput = unknown>(
  agentPath: string,
  input: unknown,
  context: Context,
  basePath?: string,
  _resumeFromRunId?: string
): Promise<ExecutionResult<TOutput> | DurableExecutionResult<TOutput>> {
  const startTime = Date.now();

  try {
    // Load agent manifest
    const manifest = await loadAgentManifest(agentPath, basePath);

    // Validate input
    const validatedInput = manifest.interface.input.parse(input);

    // Update context
    context.meta.currentStep = `agent:${manifest.id}`;
    context.meta.status = 'running';
    context.meta.updatedAt = new Date();

    // Standard execution
    let result: ExecutionResult<TOutput>;

    if (isManager(manifest)) {
      // Manager mode: execute workflow and synthesize with LLM
      console.log(`[Engine] Executing Manager: ${manifest.id}`);

      // CRITICAL: Update basePath to this agent's directory so nested workers
      // are resolved relative to the parent agent (not the global basePath)
      const previousBasePath = context.basePath;
      context.basePath = manifest.path;
      console.log(`[Engine] Updated context.basePath for workflow: ${context.basePath}`);

      const workflowContext = await executeWorkflow(manifest.workflow!, validatedInput, context);

      // Restore basePath for proper nesting
      context.basePath = previousBasePath;

      // Check for skipSynthesis config - bypass AI and use artifact directly
      if (manifest.config.skipSynthesis) {
        const outputKey = manifest.config.outputArtifact || '_output';
        console.log(`[Engine] skipSynthesis=true, using artifact: ${outputKey}`);

        // Support dot notation for nested access (e.g., "finalProgram.program")
        const output = getNestedArtifact(workflowContext.artifacts, outputKey);

        if (output === undefined) {
          throw new Error(
            `[Engine] skipSynthesis: artifact "${outputKey}" not found in workflow artifacts. ` +
              `Available keys: ${Object.keys(workflowContext.artifacts).join(', ')}`
          );
        }

        const durationMs = Date.now() - startTime;
        result = {
          success: true,
          output: output as TOutput,
          meta: {
            executionId: context.executionId,
            duration: durationMs,
            tokensUsed: context.meta.tokensUsed,
            costUSD: context.meta.costUSD,
          },
        };
      } else {
        // Use the worker to synthesize final output from workflow artifacts
        result = await executeWorker<TOutput>(manifest, workflowContext.artifacts, workflowContext);
      }
    } else {
      // Worker mode: direct LLM execution
      console.log(`[Engine] Executing Worker: ${manifest.id}`);

      result = await executeWorker<TOutput>(manifest, validatedInput, context);
    }

    // Validate output against schema
    if (result.success && result.output !== undefined) {
      result.output = manifest.interface.output.parse(result.output) as TOutput;
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    context.meta.status = 'failed';
    context.meta.error = message;
    context.meta.updatedAt = new Date();

    return {
      success: false,
      error: {
        message,
        code: 'NODE_EXECUTION_ERROR',
        recoverable: false,
      },
      meta: {
        executionId: context.executionId,
        duration: Date.now() - startTime,
        tokensUsed: context.meta.tokensUsed,
        costUSD: context.meta.costUSD,
      },
    };
  }
}

// ==================== CONTEXT FACTORY ====================

/**
 * Create a new execution context
 */
export function createContext(input: unknown, userId?: string): Context {
  const now = new Date();

  const meta: ExecutionMeta = {
    startedAt: now,
    updatedAt: now,
    currentStep: 'init',
    tokensUsed: 0,
    costUSD: 0,
    status: 'pending',
  };

  return {
    executionId: randomUUID(),
    userId: userId ?? 'anonymous',
    input,
    artifacts: {},
    memory: [],
    meta,
  };
}

// ==================== HELPERS ====================

/**
 * Get nested value from artifacts using dot notation
 * Supports paths like "finalProgram" or "finalProgram.program"
 */
function getNestedArtifact(artifacts: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = artifacts;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// ==================== MESH FACTORY ====================

export interface MeshConfig {
  basePath: string;
  agents: string[];
}

/**
 * Create a mesh for orchestrating multiple agents
 *
 * @example
 * const mesh = createMesh({
 *   basePath: './domains/workout',
 *   agents: ['agents/exercise-selection', 'agents/workout-planning']
 * });
 *
 * const result = await mesh.run('agents/workout-coordinator', input);
 */
export function createMesh(config: MeshConfig) {
  return {
    /**
     * Run an agent within the mesh
     */
    async run<TOutput = unknown>(
      agentPath: string,
      input: unknown,
      options: Omit<ExecuteOptions, 'basePath'> = {}
    ): Promise<ExecutionResult<TOutput>> {
      return execute<TOutput>(agentPath, input, {
        ...options,
        basePath: config.basePath,
      });
    },

    /**
     * Discover all agents in the mesh
     */
    getAgents(): string[] {
      return config.agents;
    },

    /**
     * Get base path
     */
    getBasePath(): string {
      return config.basePath;
    },
  };
}
