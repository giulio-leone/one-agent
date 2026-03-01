/**
 * OneAgent SDK v4.2 - Workflow Executor
 *
 * Executes workflow definitions for Manager agents.
 * Handles sequential, parallel, loop, and conditional steps.
 */

import type {
  WorkflowDef,
  WorkflowStep,
  CallStep,
  ParallelStep,
  LoopStep,
  ConditionalStep,
  TransformStep,
  Context,
  ProgressEvent,
} from './types';
import {
  resolveInputMap,
  evaluateCondition,
  cloneContext,
  setContextValue,
  resolvePath,
  resolveTemplate,
} from './resolver';
import { executeNode } from './engine';

// ==================== PROGRESS HELPER ====================

/**
 * Emit a progress event via context callback
 */
function emitProgress(
  context: Context,
  step: string,
  progress: number,
  message: string,
  data?: Record<string, unknown>
): void {
  if (context.onProgress) {
    const event: ProgressEvent = {
      step,
      progress,
      message,
      data,
      timestamp: new Date(),
    };
    context.onProgress(event);
  }
}

// ==================== PUBLIC API ====================

/**
 * Execute a workflow definition
 *
 * @param workflow - The workflow definition to execute
 * @param input - Initial input for the workflow
 * @param context - Execution context (will be mutated with artifacts)
 * @returns The final context with all artifacts populated
 */
export async function executeWorkflow(
  workflow: WorkflowDef,
  input: unknown,
  context: Context
): Promise<Context> {
  // Store input in artifacts for template resolution
  context.artifacts.input = input;
  context.meta.currentStep = 'workflow:start';

  for (const step of workflow.steps) {
    await executeStep(step, context);
  }

  context.meta.currentStep = 'workflow:complete';
  return context;
}

// ==================== STEP EXECUTION ====================

/**
 * Execute a single workflow step based on its type
 */
async function executeStep(step: WorkflowStep, context: Context): Promise<void> {
  context.meta.currentStep = `step:${step.name}`;
  context.meta.updatedAt = new Date();

  switch (step.type) {
    case 'call':
      await executeCallStep(step, context);
      break;
    case 'parallel':
      await executeParallelStep(step, context);
      break;
    case 'loop':
      await executeLoopStep(step, context);
      break;
    case 'conditional':
      await executeConditionalStep(step, context);
      break;
    case 'transform':
      await executeTransformStep(step, context);
      break;
    default:
      console.warn(`[Workflow] Unknown step type: ${(step as WorkflowStep).type}`);
  }
}
/**
 * Retry state stored in artifacts for DB persistence
 */
interface RetryState {
  stepId: string;
  attempt: number;
  maxAttempts: number;
  lastAttemptAt: string;
  lastError?: string;
  status: 'pending' | 'in_progress' | 'succeeded' | 'failed';
}

/**
 * Execute a Call step - invokes a sub-agent with DB-persisted retry support
 * Retry state is stored in artifacts._retryState[stepId] and persisted to DB
 */
async function executeCallStep(step: CallStep, context: Context): Promise<void> {
  console.warn(`[Workflow] Calling agent: ${step.agentId}`);
  console.warn(`[Workflow] InputMap:`, JSON.stringify(step.inputMap, null, 2));

  // Emit progress: starting agent
  const agentName = step.agentId.split('/').pop() ?? step.agentId;
  emitProgress(context, agentName, 0, `🔄 Starting ${agentName}...`, { agentId: step.agentId });

  // Resolve input from templates
  const resolvedInput = resolveInputMap(step.inputMap, context);
  console.warn(`[Workflow] Resolved Input:`, JSON.stringify(resolvedInput, null, 2));

  // Get retry config (default: no retry)
  const retryConfig = step.retry ?? { maxAttempts: 1, onFailure: 'abort' as const };
  const maxAttempts = retryConfig.maxAttempts;
  const baseDelay = retryConfig.delayMs ?? 1000;
  const backoffMultiplier = retryConfig.backoffMultiplier ?? 1;

  // Initialize or restore retry state from artifacts (DB-persisted)
  const retryStateKey = `_retryState`;
  const stepId = `${step.agentId}:${step.storeKey}`;

  if (!context.artifacts[retryStateKey]) {
    context.artifacts[retryStateKey] = {} as Record<string, RetryState>;
  }
  const retryStates = context.artifacts[retryStateKey] as Record<string, RetryState>;

  // Check for existing retry state (for resume after crash)
  let retryState = retryStates[stepId];
  if (retryState && retryState.status === 'succeeded') {
    console.warn(`[Workflow] Step ${stepId} already completed, skipping`);
    return;
  }

  // Initialize or continue from existing state
  let attempt = retryState?.attempt ?? 0;
  let lastError: unknown = retryState?.lastError ?? null;

  while (attempt < maxAttempts) {
    attempt++;

    // Update retry state before attempt
    retryState = {
      stepId,
      attempt,
      maxAttempts,
      lastAttemptAt: new Date().toISOString(),
      status: 'in_progress',
    };
    retryStates[stepId] = retryState;

    // Persist context to DB before attempt (crash recovery)
    context.meta.currentStep = `${step.name}:attempt:${attempt}`;
    context.meta.updatedAt = new Date();
    // Note: saveContext should be called by the engine after each major operation

    if (attempt > 1) {
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(backoffMultiplier, attempt - 2);
      console.warn(`[Workflow] Retry attempt ${attempt}/${maxAttempts} after ${delay}ms delay`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      // Execute the sub-agent with basePath from context for proper path resolution
      const result = await executeNode(step.agentId, resolvedInput, context, context.basePath);

      // Store result in artifacts
      if (result.success && result.output !== undefined) {
        setContextValue(context, `artifacts.${step.storeKey}`, result.output);

        // Mark retry state as succeeded
        retryState.status = 'succeeded';
        retryStates[stepId] = retryState;

        return; // Success - exit retry loop
      } else if (!result.success) {
        lastError = result.error;
        retryState.lastError = result.error?.message ?? String(result.error);
        retryStates[stepId] = retryState;

        console.warn(
          `[Workflow] Agent ${step.agentId} failed (attempt ${attempt}/${maxAttempts}):`,
          result.error
        );

        // If non-recoverable or last attempt, don't retry
        if (!result.error?.recoverable || attempt >= maxAttempts) {
          break;
        }
      }
    } catch (error) {
      lastError = error;
      retryState.lastError = error instanceof Error ? error.message : String(error);
      retryStates[stepId] = retryState;

      console.error(
        `[Workflow] Agent ${step.agentId} threw error (attempt ${attempt}/${maxAttempts}):`,
        error
      );

      // Continue to retry if attempts remain
      if (attempt >= maxAttempts) {
        break;
      }
    }
  }

  // All retries exhausted - mark as failed and handle
  retryState!.status = 'failed';
  retryStates[stepId] = retryState!;

  console.error(`[Workflow] Agent ${step.agentId} failed after ${maxAttempts} attempts`);
  setContextValue(context, `artifacts.${step.storeKey}_error`, lastError);

  if (retryConfig.onFailure === 'abort') {
    throw new Error(`Workflow aborted: Agent ${step.agentId} failed after ${maxAttempts} attempts`);
  } else {
    // 'continue' - proceed with null/fallback
    console.warn(
      `[Workflow] Continuing workflow despite ${step.agentId} failure (onFailure: continue)`
    );
    if (retryConfig.fallbackStore) {
      setContextValue(
        context,
        `artifacts.${step.storeKey}`,
        context.artifacts[retryConfig.fallbackStore]
      );
    } else {
      setContextValue(context, `artifacts.${step.storeKey}`, null);
    }
  }
}

/**
 * Execute a Parallel step - runs multiple branches concurrently
 */
async function executeParallelStep(step: ParallelStep, context: Context): Promise<void> {
  console.warn(`[Workflow] Executing ${step.branches.length} parallel branches`);

  // Run all branches in parallel
  await Promise.all(
    step.branches.map(async (branchSteps, branchIndex) => {
      // Each branch gets a cloned context to avoid race conditions
      const branchContext = cloneContext(context);

      for (const branchStep of branchSteps) {
        await executeStep(branchStep, branchContext);
      }

      // Merge branch artifacts back into main context
      // Note: Later branches may overwrite earlier ones for same keys
      Object.assign(context.artifacts, branchContext.artifacts);

      console.warn(`[Workflow] Branch ${branchIndex + 1} completed`);
    })
  );
}

/**
 * Execute a Loop step - iterates over an array (parallel or sequential)
 */
async function executeLoopStep(step: LoopStep, context: Context): Promise<void> {
  // Resolve the array to iterate over
  // step.over might be a template string like "${input.weekRange}" that needs resolution
  const resolvedOver =
    typeof step.over === 'string' && step.over.startsWith('${')
      ? resolveTemplate(step.over, context)
      : resolvePath(context, step.over);

  const items = resolvedOver;

  if (!Array.isArray(items)) {
    console.warn(
      `[Workflow] Loop "over" is not an array: ${step.over} (resolved: ${JSON.stringify(items)})`
    );
    return;
  }

  console.warn(`[Workflow] Looping over ${items.length} items (mode: ${step.mode})`);

  const results: unknown[] = [];

  // Extract storeKey from first step to know where to find output
  const firstStep = step.steps[0] as CallStep | undefined;
  const outputKey = firstStep?.storeKey;

  if (step.mode === 'parallel') {
    // Parallel execution
    const itemResults = await Promise.all(
      items.map(async (item, index) => {
        const itemContext = cloneContext(context);
        // Set current item in context
        itemContext.artifacts[step.itemVar] = item;
        itemContext.artifacts[`${step.itemVar}_index`] = index;

        // Execute all steps in the loop for this item
        for (const loopStep of step.steps) {
          await executeStep(loopStep, itemContext);
        }

        // Collect the OUTPUT from the step's storeKey, not the iterator value
        // If outputKey exists and was stored, use that; otherwise fall back to item
        if (outputKey && itemContext.artifacts[outputKey] !== undefined) {
          return itemContext.artifacts[outputKey];
        }
        // Fallback: return the item if no output was stored
        return itemContext.artifacts[step.itemVar];
      })
    );
    results.push(...itemResults);
  } else {
    // Sequential execution
    for (let i = 0; i < items.length; i++) {
      context.artifacts[step.itemVar] = items[i];
      context.artifacts[`${step.itemVar}_index`] = i;

      for (const loopStep of step.steps) {
        await executeStep(loopStep, context);
      }

      // Collect the OUTPUT from the step's storeKey, not the iterator value
      if (outputKey && context.artifacts[outputKey] !== undefined) {
        results.push(context.artifacts[outputKey]);
      } else {
        results.push(context.artifacts[step.itemVar]);
      }
    }
  }

  // Store collected results
  setContextValue(context, `artifacts.${step.outputKey}`, results);
}

/**
 * Execute a Conditional step - branches based on condition evaluation
 */
async function executeConditionalStep(step: ConditionalStep, context: Context): Promise<void> {
  const conditionResult = evaluateCondition(step.condition, context);

  console.warn(`[Workflow] Condition "${step.condition}" evaluated to: ${conditionResult}`);

  const stepsToExecute = conditionResult ? step.then : (step.else ?? []);

  for (const conditionalStep of stepsToExecute) {
    await executeStep(conditionalStep, context);
  }
}

/**
 * Execute a Transform step - calls a registered TypeScript function
 *
 * Transform functions are pure TypeScript that run programmatically,
 * not via AI. Use for:
 * - Cloning/patching data structures
 * - Complex calculations
 * - Data validation and normalization
 */
async function executeTransformStep(step: TransformStep, context: Context): Promise<void> {
  console.warn(`[Workflow] Executing transform: ${step.transformId}`);

  // Emit progress: starting transform
  emitProgress(context, step.transformId, 0, `🔧 Running ${step.transformId}...`, {
    transformId: step.transformId,
  });

  // Get the transform function from registry
  const { getTransform } = await import('./registry');
  const transformFn = getTransform(step.transformId);

  if (!transformFn) {
    throw new Error(
      `Transform "${step.transformId}" not found in registry. ` +
        `Available transforms: ${(await import('./registry')).getRegisteredTransformKeys().join(', ') || 'none'}`
    );
  }

  // Resolve input from templates
  const resolvedInput = resolveInputMap(step.inputMap, context);
  console.warn(
    `[Workflow] Transform Input:`,
    JSON.stringify(resolvedInput, null, 2).slice(0, 500) + '...'
  );

  try {
    // Execute the transform (may be sync or async)
    const result = await Promise.resolve(transformFn(resolvedInput));

    // Store result in artifacts
    setContextValue(context, `artifacts.${step.storeKey}`, result);

    console.warn(`[Workflow] Transform ${step.transformId} completed, stored in: ${step.storeKey}`);

    // Emit progress: completed
    emitProgress(context, step.transformId, 100, `✅ ${step.transformId} complete`, {
      storeKey: step.storeKey,
    });
  } catch (error) {
    console.error(`[Workflow] Transform ${step.transformId} failed:`, error);

    // Emit progress: failed
    emitProgress(context, step.transformId, 0, `❌ ${step.transformId} failed`, {
      error: error instanceof Error ? error.message : String(error),
    });

    throw new Error(
      `Transform "${step.transformId}" failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
