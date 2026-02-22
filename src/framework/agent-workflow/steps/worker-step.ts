/**
 * Worker Step
 *
 * Durable step for executing Worker agents with ToolLoopAgent.
 * This is the core execution step for non-Manager agents.
 *
 * Follows Single Responsibility Principle - only handles worker execution.
 *
 * @since v4.1
 * @since v5.0 - Added module-level caching for dynamic imports (performance optimization)
 * @since v5.1 - AI-driven progress via _progress field in partialOutputStream
 * @since v5.2 - Added progressRange for mapping worker progress to global workflow progress
 */

import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { FatalError, RetryableError, getStepMetadata } from 'workflow';
import type { UIMessageChunk } from 'ai';
import type { ProgressRange } from '../types';
import { OAUTH_PROVIDERS } from '../../types';
import {
  normalizeAgentPath,
  estimateTokens,
  writeProgress,
  extractProgress,
  createProgressField,
} from '../helpers';

// ============================================================================
// MODULE-LEVEL CACHING
// ============================================================================
// Cache dynamic imports at module level to avoid repeated import overhead
// during WDK workflow replay. Each step execution re-runs this function,
// so caching saves ~100-200ms per step.

let _cachedModules: {
  loadAgentManifest: typeof import('../../loader').loadAgentManifest;
  buildSystemPrompt: typeof import('../../worker').buildSystemPrompt;
  connectToMCPServers: typeof import('../../mcp').connectToMCPServers;
  mcpToolsToAiSdk: typeof import('../../mcp').mcpToolsToAiSdk;
  getAgentTools: typeof import('../../registry').getAgentTools;
  PROGRESS_PROMPT_INSTRUCTIONS: typeof import('../../types').PROGRESS_PROMPT_INSTRUCTIONS;
  getModelByTier: typeof import('@giulio-leone/lib-ai').getModelByTier;
  AIProviderConfigService: typeof import('@giulio-leone/lib-ai').AIProviderConfigService;
  createModelAsync: typeof import('@giulio-leone/lib-ai').createModelAsync;
} | null = null;

/**
 * Load and cache all required modules for worker execution.
 * Returns cached modules on subsequent calls.
 */
async function getCachedModules() {
  if (_cachedModules) return _cachedModules;

  const [loaderMod, workerMod, mcpMod, registryMod, typesMod, libAiMod] = await Promise.all([
    import('../../loader'),
    import('../../worker'),
    import('../../mcp'),
    import('../../registry'),
    import('../../types'),
    import('@giulio-leone/lib-ai'),
  ]);

  _cachedModules = {
    loadAgentManifest: loaderMod.loadAgentManifest,
    buildSystemPrompt: workerMod.buildSystemPrompt,
    connectToMCPServers: mcpMod.connectToMCPServers,
    mcpToolsToAiSdk: mcpMod.mcpToolsToAiSdk,
    getAgentTools: registryMod.getAgentTools,
    PROGRESS_PROMPT_INSTRUCTIONS: typesMod.PROGRESS_PROMPT_INSTRUCTIONS,
    getModelByTier: libAiMod.getModelByTier,
    AIProviderConfigService: libAiMod.AIProviderConfigService,
    createModelAsync: libAiMod.createModelAsync,
  };

  return _cachedModules;
}

/**
 * Result from worker step execution.
 */
export interface WorkerStepResult {
  object: unknown;
  usage?: { totalTokens?: number };
}

// ============================================================================
// PROGRESS RANGE MAPPING
// ============================================================================

/**
 * Map a local progress value (0-100) to a global progress range.
 *
 * Example: If progressRange = { start: 20, end: 40 } and localProgress = 50,
 * the global progress = 20 + (50/100) * (40-20) = 30
 *
 * @param localProgress - Progress within the worker (0-100)
 * @param range - Global progress range for this step, or undefined for standalone worker
 * @returns Mapped global progress value
 */
function mapProgressToRange(localProgress: number, range?: ProgressRange): number {
  if (!range) {
    // Standalone worker (not in a workflow) - use local progress directly
    return localProgress;
  }

  const { start, end } = range;
  return Math.round(start + (localProgress / 100) * (end - start));
}

/**
 * Execute a Worker sub-agent with streaming progress.
 * Uses ToolLoopAgent internally and streams AI-driven _progress events.
 *
 * Progress streaming follows the OneFlight pattern:
 * 1. AI populates _progress field in its structured output
 * 2. partialOutputStream emits partial objects with _progress
 * 3. We extract and forward progress to WDK stream
 *
 * Progress Range Mapping (v5.2):
 * When called from a workflow, progressRange maps local 0-100 to the step's slice.
 * When called standalone, progressRange is undefined and local progress is used directly.
 *
 * @param writable - WritableStream passed from the workflow
 * @param agentId - Agent identifier
 * @param basePath - Base path for agent resolution
 * @param inputJson - JSON-serialized input
 * @param userId - Optional user ID
 * @param stepPrefix - Optional prefix for progress step names (for nested context)
 * @param progressRange - Optional range for mapping local progress to global workflow progress
 *
 * WDK Configuration:
 * - maxRetries: 3 (with exponential backoff)
 */
export async function executeWorkerStep(
  writable: WritableStream<UIMessageChunk>,
  agentId: string,
  basePath: string,
  inputJson: string,
  _userId?: string,
  stepPrefix?: string,
  progressRange?: ProgressRange
): Promise<WorkerStepResult> {
  'use step';

  const metadata = getStepMetadata();
  const writer = writable.getWriter();
  const prefix = stepPrefix ? `${stepPrefix}:` : '';

  // Determine if we're in a workflow (should NOT emit 100% at end)
  const isInWorkflow = !!progressRange;

  try {
    const input = JSON.parse(inputJson);

    await writeProgress(
      writer,
      createProgressField(
        `${prefix}init`,
        'Initializing...',
        mapProgressToRange(5, progressRange),
        'loading'
      )
    );

    // Load cached modules (performance optimization: avoid repeated imports)
    const {
      loadAgentManifest,
      buildSystemPrompt,
      connectToMCPServers,
      mcpToolsToAiSdk,
      getAgentTools,
      PROGRESS_PROMPT_INSTRUCTIONS,
      getModelByTier,
      AIProviderConfigService,
      createModelAsync,
    } = await getCachedModules();

    const agentPath = normalizeAgentPath(agentId);
    const manifest = await loadAgentManifest(agentPath, basePath);

    await writeProgress(
      writer,
      createProgressField(
        `${prefix}loading`,
        'Loading agent configuration...',
        mapProgressToRange(10, progressRange),
        'loading'
      )
    );

    // Build system prompt with progress instructions
    let systemPrompt = await buildSystemPrompt(manifest, input);
    systemPrompt = systemPrompt + '\n\n' + PROGRESS_PROMPT_INSTRUCTIONS;

    console.log(`[WorkerStep] ${agentId} system prompt: ${systemPrompt.length} chars`);

    // Load tools
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: Record<string, any> = {};

    const registryTools = getAgentTools(agentId);
    if (registryTools) {
      Object.assign(tools, registryTools);
    }

    if (manifest.mcpServers) {
      try {
        await writeProgress(
          writer,
          createProgressField(
            `${prefix}connecting`,
            'Connecting to services...',
            mapProgressToRange(15, progressRange),
            'loading'
          )
        );

        const mcpTools = await connectToMCPServers(manifest.mcpServers);
        const aiSdkTools = mcpToolsToAiSdk(mcpTools);
        Object.assign(tools, aiSdkTools);
        console.log(`[WorkerStep] ${agentId} loaded ${Object.keys(aiSdkTools).length} MCP tools`);
      } catch (err) {
        console.warn(`[WorkerStep] ${agentId} MCP connection failed:`, err);
      }
    }

    // Get model config
    const tier = manifest.config.tier || 'balanced';
    const modelConfig = await getModelByTier(tier);
    console.log(
      `[WorkerStep] ${agentId} using model: ${modelConfig.model} (${modelConfig.provider})`
    );

    // Get API key
    const isOAuthProvider = OAUTH_PROVIDERS.includes(
      modelConfig.provider as (typeof OAUTH_PROVIDERS)[number]
    );
    const apiKey = await AIProviderConfigService.getApiKey(
      modelConfig.provider as import('@giulio-leone/lib-ai').ProviderName
    );

    if (!apiKey && !isOAuthProvider) {
      throw new FatalError(`API key missing for provider ${modelConfig.provider}`);
    }

    // Create model
    const model = await createModelAsync(
      modelConfig as import('@giulio-leone/lib-ai').ModelConfig,
      apiKey ?? '',
      manifest.config.temperature
    );

    // Build user prompt
    const userPrompt =
      typeof input === 'string'
        ? input
        : `Process the following input and generate a ${agentId} output:\n\n${JSON.stringify(input, null, 2)}`;

    // Create ToolLoopAgent
    const maxSteps = manifest.config.maxSteps ?? 10;

    const agent = new ToolLoopAgent({
      model,
      instructions: systemPrompt,
      tools,
      stopWhen: stepCountIs(maxSteps),
      toolChoice: Object.keys(tools).length > 0 ? 'auto' : 'none',
      output: Output.object({
        schema: manifest.interface.output,
      }),
    });

    await writeProgress(
      writer,
      createProgressField(
        `${prefix}executing`,
        'Processing request...',
        mapProgressToRange(20, progressRange),
        'loading'
      )
    );

    // Execute with streaming
    const streamResult = await agent.stream({ prompt: userPrompt });

    // Track last emitted progress to prevent duplicates and for interpolation
    let lastEmittedStep: string | null = null;
    let lastEmittedLocalProgress = 20; // Track LOCAL progress (0-100) for internal calculations
    let aiProgressCount = 0;
    let tokensUsed = 0;

    // Process partialOutputStream for AI-driven _progress (primary source)
    // This is the OneFlight pattern: AI populates _progress, we extract and stream it
    const progressPromise = (async () => {
      try {
        for await (const partial of streamResult.partialOutputStream) {
          const progress = extractProgress(partial);
          if (progress) {
            // Deduplicate by step name
            const stepKey = `${prefix}${progress.step}`;
            if (stepKey !== lastEmittedStep) {
              progress.step = stepKey;
              // Map the AI's progress (which is local 0-100) to global range
              progress.estimatedProgress = mapProgressToRange(
                progress.estimatedProgress,
                progressRange
              );
              await writeProgress(writer, progress);
              lastEmittedStep = stepKey;
              lastEmittedLocalProgress = progress.estimatedProgress;
              aiProgressCount++;
            }
          }
        }
      } catch (err) {
        console.warn(`[WorkerStep] ${agentId} partialOutputStream error:`, err);
      }
    })();

    // Process fullStream for tool events (secondary source, fallback progress)
    // Only emit tool progress if AI isn't providing progress
    const toolStreamPromise = (async () => {
      try {
        for await (const chunk of streamResult.fullStream) {
          if (chunk.type === 'tool-call') {
            // Only emit synthetic tool progress if AI hasn't been providing progress
            if (aiProgressCount === 0) {
              // Calculate local progress (capped at 80 to leave room for completion)
              const localProgress = Math.min(lastEmittedLocalProgress + 10, 80);
              const toolProgress = createProgressField(
                `${prefix}tool:${chunk.toolName}`,
                `Calling ${chunk.toolName}...`,
                mapProgressToRange(localProgress, progressRange),
                'search',
                {
                  toolName: chunk.toolName,
                  adminDetails:
                    'input' in chunk
                      ? `Args: ${JSON.stringify(chunk.input).slice(0, 200)}`
                      : undefined,
                }
              );
              await writeProgress(writer, toolProgress);
              lastEmittedLocalProgress = localProgress;
            }
          }
        }
      } catch (err) {
        console.warn(`[WorkerStep] ${agentId} fullStream error:`, err);
      }
    })();

    await Promise.all([progressPromise, toolStreamPromise]);

    // Log AI progress statistics for debugging
    console.log(`[WorkerStep] ${agentId} AI emitted ${aiProgressCount} progress updates`);

    const finalOutput = await streamResult.output;
    tokensUsed = estimateTokens(systemPrompt, userPrompt, finalOutput);

    // Only emit 100% completion if we're a standalone worker (not in a workflow).
    // When in a workflow, the Manager controls progress and will emit
    // progress updates for each step's completion from the workflow loop.
    if (!isInWorkflow) {
      await writeProgress(
        writer,
        createProgressField(`${prefix}complete`, 'Complete!', 100, 'success')
      );
    } else {
      // Emit progress at end of this step's range (but not 100%)
      await writeProgress(
        writer,
        createProgressField(
          `${prefix}step-done`,
          'Step completed',
          mapProgressToRange(95, progressRange), // 95% of this step's range
          'success'
        )
      );
    }

    console.log(`[WorkerStep] ${agentId} execution complete`);

    return {
      object: finalOutput,
      usage: { totalTokens: tokensUsed },
    };
  } catch (error) {
    // WDK-native retry with exponential backoff
    if (metadata.attempt < 3 && !(error instanceof FatalError)) {
      throw new RetryableError(error instanceof Error ? error.message : String(error), {
        retryAfter: Math.pow(2, metadata.attempt) * 1000, // 2s, 4s, 8s
      });
    }
    throw error;
  } finally {
    writer.releaseLock();
  }
}

// WDK retry config
Object.defineProperty(executeWorkerStep, 'maxRetries', { value: 3, writable: false });
