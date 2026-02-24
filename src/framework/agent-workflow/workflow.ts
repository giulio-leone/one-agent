/**
 * OneAgent SDK v4.1 - Durable Agent Workflow
 *
 * Main workflow function with streaming & Manager orchestration.
 * This file is intentionally kept minimal - all logic is delegated to specialized modules.
 *
 * KEY FEATURES:
 * - Worker agents: Execute with ToolLoopAgent + streaming
 * - Manager agents: Orchestrate WORKFLOW.md steps with WDK-native patterns
 * - Nested Managers: Child workflows with stream piping
 * - WDK-native retry: maxRetries, RetryableError, FatalError
 *
 * ARCHITECTURE (SOLID Principles):
 * - Single Responsibility: Each module handles one concern
 * - Open/Closed: Easy to add new step types via orchestration/
 * - Dependency Inversion: Uses interfaces, not concrete implementations
 *
 * WDK SERIALIZATION:
 * - All step return values must be serializable (no Zod schemas, no functions)
 * - loadManifestStep returns SerializableManifestInfo, not full AgentManifest
 * - Steps that need full manifest load it internally
 *
 * @see https://useworkflow.dev/docs/foundations/streaming
 * @see https://useworkflow.dev/docs/foundations/serialization
 * @see https://useworkflow.dev/docs/foundations/errors-and-retries
 * @since v4.0 - Initial durable execution
 * @since v4.1 - Added Manager orchestration with WDK-native patterns
 * @since v4.2 - Refactored to modular structure (KISS/DRY/SOLID), fixed serialization
 * @since v5.1 - Improved progress messages for workflows
 */

import { getWritable, FatalError } from '../workflow-shim';
import type { UIMessageChunk } from 'ai';
import type { WorkflowStep, CallStep, ParallelStep, LoopStep, TransformStep } from '../types';

import type {
  AgentWorkflowParams,
  AgentWorkflowResult,
  OrchestrationContext,
  StepExecutionContext,
  SerializableManifestInfo,
} from './types';
import { getNestedValue, createProgressField } from './helpers';
import {
  loadManifestStep,
  executeWorkerStep,
  writeProgressStep,
  writeFinishStep,
  closeStreamStep,
} from './steps';
import { executeWorkflowStep } from './orchestration';

// ============================================================================
// USER-FRIENDLY PROGRESS MESSAGES
// ============================================================================

/**
 * Icon hints for different step types
 */
const STEP_TYPE_ICONS: Record<
  WorkflowStep['type'],
  'search' | 'analyze' | 'compare' | 'loading' | 'success'
> = {
  call: 'loading',
  parallel: 'loading',
  loop: 'loading',
  conditional: 'analyze',
  transform: 'loading',
};

/**
 * Generate a user-friendly message for a workflow step.
 * Uses the step type and agent ID to create context-aware messages.
 */
function getStepUserMessage(step: WorkflowStep, stepIndex: number, totalSteps: number): string {
  const baseProgress = `(${stepIndex + 1}/${totalSteps})`;

  switch (step.type) {
    case 'call': {
      const callStep = step as CallStep;
      const agentName = callStep.agentId.split('/').pop() || callStep.agentId;
      return `Running ${agentName}... ${baseProgress}`;
    }

    case 'parallel': {
      const parallelStep = step as ParallelStep;
      const branchCount = parallelStep.branches.length;
      return `Running ${branchCount} parallel tasks... ${baseProgress}`;
    }

    case 'loop': {
      const loopStep = step as LoopStep;
      return `Processing ${loopStep.itemVar} items... ${baseProgress}`;
    }

    case 'conditional': {
      return `Evaluating condition... ${baseProgress}`;
    }

    case 'transform': {
      const transformStep = step as TransformStep;
      return `Applying ${transformStep.transformId}... ${baseProgress}`;
    }
  }
}

/**
 * Get icon hint for a step based on its type or agent ID.
 */
function getStepIcon(step: WorkflowStep): 'search' | 'analyze' | 'compare' | 'loading' | 'success' {
  return STEP_TYPE_ICONS[step.type] ?? 'loading';
}

/**
 * Durable agent workflow function with streaming and Manager orchestration.
 *
 * This function is marked with "use workflow" to enable WDK durability.
 * The WDK compiler will transform this into a durable workflow that:
 * - Persists state to the configured World (Postgres)
 * - Can resume after crashes/restarts
 * - Provides observability via the WDK dashboard
 * - Streams progress via getWritable()
 *
 * WORKFLOW EXECUTION:
 * - Worker agents: Execute with ToolLoopAgent + streaming (existing behavior)
 * - Manager agents: Orchestrate WORKFLOW.md steps with WDK-native patterns
 * - Nested Managers: Launch child workflows with stream piping
 */
export async function agentWorkflow(params: AgentWorkflowParams): Promise<AgentWorkflowResult> {
  'use workflow';

  const startTime = Date.now();
  let tokensUsed = 0;

  // Get the writable stream in the workflow (WDK requirement)
  const writable = getWritable<UIMessageChunk>();

  try {
    // 1. Load manifest info to determine agent type (Manager or Worker)
    // NOTE: Returns SerializableManifestInfo, NOT full AgentManifest (Zod schemas not serializable)
    console.log(`[AgentWorkflow] Loading manifest for: ${params.agentId}`);
    const manifestInfo = await loadManifestStep(params.agentId, params.basePath);

    // 2. Check if Worker or Manager
    if (!manifestInfo.hasWorkflow) {
      // === WORKER MODE ===
      return await executeWorkerMode(writable, params, startTime);
    }

    // === MANAGER MODE ===
    return await executeManagerMode(writable, params, manifestInfo, startTime, tokensUsed);
  } catch (error) {
    console.error(`[AgentWorkflow] Workflow failed:`, error);

    // Ensure stream is closed on error
    try {
      await closeStreamStep(writable);
    } catch {
      // Ignore close errors
    }

    const errorCode = error instanceof FatalError ? 'FATAL_ERROR' : 'WORKFLOW_EXECUTION_FAILED';

    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: errorCode,
      },
      meta: {
        duration: Date.now() - startTime,
        tokensUsed: 0,
        costUSD: 0,
      },
    };
  }
}

/**
 * Execute workflow in Worker mode (simple agent execution).
 */
async function executeWorkerMode(
  writable: WritableStream<UIMessageChunk>,
  params: AgentWorkflowParams,
  startTime: number
): Promise<AgentWorkflowResult> {
  console.log(`[AgentWorkflow] ${params.agentId} is a Worker, executing directly`);

  const result = await executeWorkerStep(
    writable,
    params.agentId,
    params.basePath,
    params.inputJson,
    params.userId
  );

  // Emit lightweight finish signal before closing
  // NOTE: We don't pass the full output here to avoid WDK step serialization overhead
  // The actual output is returned via AgentWorkflowResult
  await writeFinishStep(writable, { completed: true });
  await closeStreamStep(writable);

  return {
    success: true,
    output: result.object,
    meta: {
      duration: Date.now() - startTime,
      tokensUsed: result.usage?.totalTokens ?? 0,
      costUSD: 0,
    },
  };
}

/**
 * Execute workflow in Manager mode (orchestrates sub-agents).
 *
 * @param manifestInfo - Serializable manifest info (no Zod schemas)
 */
async function executeManagerMode(
  writable: WritableStream<UIMessageChunk>,
  params: AgentWorkflowParams,
  manifestInfo: SerializableManifestInfo,
  startTime: number,
  tokensUsed: number
): Promise<AgentWorkflowResult> {
  console.log(
    `[AgentWorkflow] ${params.agentId} is a Manager with ${manifestInfo.workflow!.steps.length} workflow steps`
  );

  // Initialize orchestration context
  const ctx: OrchestrationContext = {
    artifacts: { input: JSON.parse(params.inputJson) },
    input: JSON.parse(params.inputJson),
  };

  // Write initial progress
  await writeProgressStep(
    writable,
    createProgressField('workflow:start', `Starting ${params.agentId}...`, 5, 'loading')
  );

  // Execute workflow steps with progress range mapping
  // Progress is distributed across 10-90% range based on step weight
  const steps = manifestInfo.workflow!.steps;
  const PROGRESS_START = 10;
  const PROGRESS_END = 90;
  const totalWeight = steps.reduce((sum, step) => sum + Math.max(step.weight ?? 1, 1), 0);
  let currentProgress = PROGRESS_START;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;

    const stepWeight = Math.max(step.weight ?? 1, 1);
    const slice = ((PROGRESS_END - PROGRESS_START) * stepWeight) / totalWeight;
    const stepStart = Math.round(currentProgress);
    const stepEnd = i === steps.length - 1 ? PROGRESS_END : Math.round(currentProgress + slice);
    const progressRange = { start: stepStart, end: stepEnd };
    currentProgress += slice;

    const userMessage = getStepUserMessage(step, i, steps.length);
    const iconHint = getStepIcon(step);

    // Emit progress at start of step
    await writeProgressStep(
      writable,
      createProgressField(`workflow:step:${step.name}`, userMessage, stepStart, iconHint)
    );

    // Create execution context with progress range for this step
    const stepExecCtx: StepExecutionContext = {
      writable,
      manifestInfo,
      params,
      progressRange,
    };

    await executeWorkflowStep(step, ctx, stepExecCtx, agentWorkflow);
  }

  // Handle output
  let output: unknown;

  if (manifestInfo.config.skipSynthesis) {
    const outputKey = manifestInfo.config.outputArtifact || '_output';
    console.log(`[AgentWorkflow] skipSynthesis=true, using artifact: ${outputKey}`);

    output = getNestedValue(ctx.artifacts, outputKey);

    if (output === undefined) {
      throw new FatalError(
        `skipSynthesis: artifact "${outputKey}" not found. Available: ${Object.keys(ctx.artifacts).join(', ')}`
      );
    }
  } else {
    // Synthesize output using Worker pattern
    console.log(`[AgentWorkflow] Synthesizing final output with Manager agent`);

    await writeProgressStep(
      writable,
      createProgressField('workflow:synthesis', 'Synthesizing final output...', 90, 'analyze')
    );

    // Synthesis uses the 90-98% range (leaving 98-100% for final completion message)
    const synthResult = await executeWorkerStep(
      writable,
      params.agentId,
      params.basePath,
      JSON.stringify(ctx.artifacts),
      params.userId,
      'synthesis',
      { start: 90, end: 98 } // Progress range for synthesis step
    );

    output = synthResult.object;
    tokensUsed += synthResult.usage?.totalTokens ?? 0;
  }

  // Write final completion
  await writeProgressStep(
    writable,
    createProgressField('workflow:complete', 'Workflow completed successfully!', 100, 'success')
  );

  // Emit lightweight finish signal
  // NOTE: We don't pass the full output here to avoid WDK step serialization overhead
  // The actual output is returned via AgentWorkflowResult
  await writeFinishStep(writable, { completed: true });
  await closeStreamStep(writable);

  console.log(`[AgentWorkflow] Manager workflow completed successfully`);

  return {
    success: true,
    output,
    meta: {
      duration: Date.now() - startTime,
      tokensUsed,
      costUSD: 0,
    },
  };
}
