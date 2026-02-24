/**
 * Runtime compatibility layer.
 *
 * Adapter-first facade so callers no longer depend directly on Workflow runtime modules.
 * Today it falls back to legacy Workflow runtime APIs while GaussFlow run-level adapter is completed.
 */

export interface CompatRunHandle<TOutput = unknown> {
  runId: string;
  readable: ReadableStream<unknown>;
  getReadable: (options?: { startIndex?: number }) => ReadableStream<unknown>;
  status: Promise<string>;
  returnValue: Promise<TOutput>;
  cancel: () => Promise<void>;
}

let gaussFlowFallbackWarned = false;

function resolveRuntimeMode(): 'legacy' | 'gaussflow' {
  return process.env.ONE_AGENT_RUNTIME === 'gaussflow' ? 'gaussflow' : 'legacy';
}

function warnGaussFlowFallback(): void {
  if (gaussFlowFallbackWarned) return;
  gaussFlowFallbackWarned = true;
  console.warn(
    '[RuntimeCompat] ONE_AGENT_RUNTIME=gaussflow requested; using legacy workflow runtime until GaussFlow run adapter is enabled.'
  );
}

async function loadCoreRuntime(): Promise<unknown> {
  if (resolveRuntimeMode() === 'gaussflow') {
    warnGaussFlowFallback();
  }
  return import('@workflow/core/runtime');
}

export async function startCompatRun(
  workflow: unknown,
  params: unknown[]
): Promise<CompatRunHandle> {
  const { start } = (await loadCoreRuntime()) as {
    start: (workflow: unknown, params: unknown[]) => Promise<CompatRunHandle>;
  };
  return (await start(workflow, params)) as CompatRunHandle;
}

export async function getCompatRunFromCore<TOutput = unknown>(
  runId: string
): Promise<CompatRunHandle<TOutput>> {
  const { getRun } = (await loadCoreRuntime()) as {
    getRun: <TResult = unknown>(id: string) => CompatRunHandle<TResult>;
  };
  return getRun<TOutput>(runId);
}

export async function getCompatRunFromApi<TOutput = unknown>(
  runId: string
): Promise<CompatRunHandle<TOutput>> {
  if (resolveRuntimeMode() === 'gaussflow') {
    warnGaussFlowFallback();
  }
  const { getRun } = await import('workflow/api');
  return getRun(runId) as CompatRunHandle<TOutput>;
}

export async function classifyCompatRunError(
  error: unknown
): Promise<'not-completed' | 'failed' | 'unknown'> {
  if (resolveRuntimeMode() === 'gaussflow') {
    warnGaussFlowFallback();
  }
  const { WorkflowRunNotCompletedError, WorkflowRunFailedError } = await import('@workflow/errors');
  if (WorkflowRunNotCompletedError.is(error)) return 'not-completed';
  if (WorkflowRunFailedError.is(error)) return 'failed';
  return 'unknown';
}
