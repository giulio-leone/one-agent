/**
 * OneAgent SDK v4.2 - Durable Execution
 *
 * Executes an agent using WDK (Workflow Development Kit) for durability.
 * Provides automatic checkpointing, resume from failure, and observability.
 *
 * Key features:
 * - Same interface as executeWorker() for easy migration
 * - Automatic checkpointing at step/tool boundaries
 * - Resume from workflowRunId on failure
 * - Durable runtime bootstrap for self-hosted persistence
 *
 * @since v4.2
 */

import type {
  AgentManifest,
  Context,
  DurableExecutionResult,
  DurableExecuteOptions,
  WorkflowEvent,
} from './types';
import { getCompatRunFromCore, startCompatRun } from './runtime-compat';

// ==================== PUBLIC API ====================

/**
 * Execute an agent using WDK for durability
 *
 * This is the durable alternative to executeWorker.
 * Wraps the agent execution in a WDK workflow for checkpoint/resume capability.
 *
 * Usage:
 * ```typescript
 * // In agent.json, set executionMode: 'durable'
 * // Then execute() will automatically route to this function
 *
 * const result = await execute('domains/workout/coordinator', input, {
 *   userId: 'user-123',
 * });
 *
 * if (!result.success && result.workflowRunId) {
 *   // Resume later
 *   const resumed = await execute('domains/workout/coordinator', input, {
 *     resumeFromRunId: result.workflowRunId,
 *   });
 * }
 * ```
 *
 * @param manifest - Agent manifest with config and schemas
 * @param input - Validated input data
 * @param context - Execution context
 * @param options - Optional execution overrides
 * @returns DurableExecutionResult with workflowRunId for resume
 */
export async function executeDurable<TOutput = unknown>(
  manifest: AgentManifest,
  input: unknown,
  context: Context,
  options: DurableExecuteOptions = {}
): Promise<DurableExecutionResult<TOutput>> {
  const startTime = Date.now();

  try {
    // Check if resuming from existing run
    if (options.resumeFromRunId) {
      console.log(`[Durable] Resuming from workflow run: ${options.resumeFromRunId}`);
      return pollExistingRun<TOutput>(options.resumeFromRunId, context, startTime);
    }

    // Ensure basePath is defined (required for workflow execution)
    if (!context.basePath) {
      throw new Error('[Durable] context.basePath is required for durable execution');
    }

    // Execute using WDK start() API with minimal params
    // Heavy data (prompts, schemas, tools) is reconstructed inside the workflow step
    const result = await executeWithWDK<TOutput>({
      manifest,
      input,
      context,
      onEvent: options.onWorkflowEvent,
    });

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
        code: 'DURABLE_EXECUTION_ERROR',
        recoverable: true, // Durable executions can be retried/resumed
      },
      meta: {
        executionId: context.executionId,
        duration: Date.now() - startTime,
        tokensUsed: 0,
        costUSD: 0,
      },
    };
  }
}

/**
 * Get the status of a durable workflow run
 *
 * @param workflowRunId - The workflow run ID to check
 * @returns Current status and progress
 */
export async function getDurableWorkflowStatus(workflowRunId: string): Promise<{
  status: string;
  progress: number;
  currentStep?: string;
  error?: string;
  output?: unknown;
}> {
  try {
    const run = await getCompatRunFromCore(workflowRunId);

    const status = await run.status;

    if (status === 'completed') {
      const output = await run.returnValue;
      return {
        status: 'completed',
        progress: 100,
        output,
      };
    }

    return {
      status,
      progress: calculateProgressFromStatus(status),
    };
  } catch (error) {
    console.error('[Durable] Failed to get workflow status:', error);
    return { status: 'error', progress: 0, error: String(error) };
  }
}

/**
 * Cancel a running durable workflow
 *
 * @param workflowRunId - The workflow run ID to cancel
 * @returns true if cancelled, false if workflow not found or already completed
 */
export async function cancelDurableWorkflow(workflowRunId: string): Promise<boolean> {
  try {
    // Get the run - this may throw if run doesn't exist
    const run = await getCompatRunFromCore(workflowRunId);

    // Check if the run has a valid status before trying to cancel
    // WDK throws ZodError if the run data is invalid/incomplete
    try {
      const status = await run.status;

      // Only try to cancel if it's actually running or pending
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        console.log(`[Durable] Workflow ${workflowRunId} already ${status}, no cancel needed`);
        return true; // Already finished
      }

      await run.cancel();
      console.log(`[Durable] Workflow ${workflowRunId} cancelled successfully`);
      return true;
    } catch (statusError) {
      // If we can't get status, the run data is likely invalid
      // This can happen with manually created test runs or corrupted data
      console.warn(
        `[Durable] Could not get workflow status for ${workflowRunId}:`,
        statusError instanceof Error ? statusError.message : statusError
      );

      // Try to cancel anyway - might work if only status check failed
      try {
        await run.cancel();
        return true;
      } catch {
        // If cancel also fails, the run is likely invalid/doesn't exist
        return false;
      }
    }
  } catch (error) {
    // getRun() threw - workflow doesn't exist or WDK not initialized
    console.error(
      '[Durable] Failed to cancel workflow:',
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

// ==================== INTERNAL ====================

/**
 * Poll an existing workflow run for completion
 */
async function pollExistingRun<TOutput>(
  runId: string,
  context: Context,
  startTime: number
): Promise<DurableExecutionResult<TOutput>> {
  try {
    const run = await getCompatRunFromCore<TOutput>(runId);

    // Get current status
    const status = await run.status;

    if (status === 'completed') {
      const output = await run.returnValue;

      context.meta.status = 'completed';
      context.meta.updatedAt = new Date();

      return {
        success: true,
        output,
        workflowRunId: runId,
        workflowStatus: 'completed',
        meta: {
          executionId: context.executionId,
          duration: Date.now() - startTime,
          tokensUsed: 0,
          costUSD: 0,
        },
      };
    }

    if (status === 'failed' || status === 'cancelled') {
      return {
        success: false,
        workflowRunId: runId,
        workflowStatus: status,
        error: {
          message: `Workflow ${status}`,
          code: `WORKFLOW_${status.toUpperCase()}`,
          recoverable: false,
        },
        meta: {
          executionId: context.executionId,
          duration: Date.now() - startTime,
          tokensUsed: 0,
          costUSD: 0,
        },
      };
    }

    // Still running or pending
    return {
      success: false,
      workflowRunId: runId,
      workflowStatus: status as 'pending' | 'running' | 'paused',
      error: {
        message: `Workflow still ${status} - poll again to wait for completion`,
        code: 'WORKFLOW_IN_PROGRESS',
        recoverable: true,
      },
      meta: {
        executionId: context.executionId,
        duration: Date.now() - startTime,
        tokensUsed: 0,
        costUSD: 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowRunId: runId,
      workflowStatus: 'failed',
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 'WORKFLOW_POLL_FAILED',
        recoverable: false,
      },
      meta: {
        executionId: context.executionId,
        duration: Date.now() - startTime,
        tokensUsed: 0,
        costUSD: 0,
      },
    };
  }
}

/**
 * Execute the agent using WDK's official start() API.
 *
 * This uses the official Workflow SDK pattern:
 * 1. Import the workflow function (compiled by @workflow/next)
 * 2. Call start() to submit it to the WDK runtime with MINIMAL params
 * 3. Await the result via run.returnValue
 *
 * IMPORTANT: Params passed to start() are serialized via CBOR.
 * We pass only identifiers - the workflow step reconstructs heavy data internally.
 */
async function executeWithWDK<TOutput>(params: {
  manifest: AgentManifest;
  input: unknown;
  context: Context;
  onEvent?: (event: WorkflowEvent) => void;
}): Promise<DurableExecutionResult<TOutput>> {
  const { manifest, input, context, onEvent } = params;
  const startTime = Date.now();

  try {
    // Import the agent workflow function
    const { agentWorkflow } = await import('./agent-workflow');

    onEvent?.({
      type: 'step_start',
      step: 'agent_execution',
      timestamp: new Date(),
    });

    // Start the workflow using WDK's official API
    // CRITICAL: Pass only minimal params to avoid CBOR serialization issues
    // Heavy data (prompts, schemas, tools) is reconstructed inside the workflow step
    const run = await startCompatRun(agentWorkflow, [
      {
        agentId: manifest.id,
        basePath: context.basePath!, // Validated earlier in executeDurable()
        inputJson: JSON.stringify(input),
        userId: context.userId,
        executionId: context.executionId,
      },
    ]);

    console.log(`[Durable] Started WDK workflow run: ${run.runId}`);

    // Wait for the workflow to complete
    const result = await run.returnValue;

    onEvent?.({
      type: 'complete',
      data: result,
      timestamp: new Date(),
    });

    context.meta.status = 'completed';
    context.meta.updatedAt = new Date();

    // Handle workflow result
    if (result && typeof result === 'object' && 'success' in result) {
      const typedResult = result as {
        success: boolean;
        output?: TOutput;
        error?: { message: string };
        meta?: { tokensUsed?: number; duration?: number };
      };

      if (!typedResult.success) {
        throw new Error(typedResult.error?.message || 'Workflow execution failed');
      }

      return {
        success: true,
        output: typedResult.output as TOutput,
        workflowRunId: run.runId,
        workflowStatus: 'completed',
        meta: {
          executionId: context.executionId,
          duration: Date.now() - startTime,
          tokensUsed: typedResult.meta?.tokensUsed ?? 0,
          costUSD: 0,
        },
      };
    }

    // If result doesn't match expected shape, return it directly
    return {
      success: true,
      output: result as TOutput,
      workflowRunId: run.runId,
      workflowStatus: 'completed',
      meta: {
        executionId: context.executionId,
        duration: Date.now() - startTime,
        tokensUsed: 0,
        costUSD: 0,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("Cannot find module '@workflow")) {
      throw new Error(
        `Workflow runtime packages not installed. Install @workflow/core (legacy) or @giulio-leone/gaussflow-agent (recommended).`
      );
    }

    throw error;
  }
}

/**
 * Calculate progress from status
 */
function calculateProgressFromStatus(status: string): number {
  switch (status) {
    case 'completed':
      return 100;
    case 'running':
      return 50;
    case 'pending':
      return 10;
    default:
      return 0;
  }
}
