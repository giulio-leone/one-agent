/**
 * GaussFlow runtime bootstrap.
 *
 * Replaces legacy Postgres World bootstrap while preserving backward-compatible
 * WDK-named exports used by existing callers.
 */

let runtimeInitialized = false;
let runtimeVersion: string | undefined;
let runtimeError: string | undefined;

export async function initializeGaussFlowRuntime(): Promise<void> {
  if (runtimeInitialized) {
    console.log('[GaussFlow] Runtime already initialized');
    return;
  }

  try {
    const gaussFlowPackage = '@giulio-leone/gaussflow-agent';
    const gaussFlowModule = await import(gaussFlowPackage);
    runtimeVersion =
      typeof (gaussFlowModule as { version?: unknown }).version === 'string'
        ? (gaussFlowModule as { version: string }).version
        : 'latest';
    runtimeInitialized = true;
    runtimeError = undefined;
    console.log('[GaussFlow] ✅ Runtime initialized', { version: runtimeVersion });
  } catch (error) {
    runtimeInitialized = false;
    runtimeError = error instanceof Error ? error.message : String(error);
    console.error('[GaussFlow] ❌ Failed to initialize runtime:', runtimeError);
  }
}

export function isGaussFlowRuntimeAvailable(): boolean {
  return runtimeInitialized;
}

export async function getGaussFlowRuntimeStatus(): Promise<{
  available: boolean;
  type: string;
  version?: string;
  error?: string;
}> {
  if (!runtimeInitialized) {
    return {
      available: false,
      type: 'none',
      error: runtimeError,
    };
  }

  return {
    available: true,
    type: 'gauss-flow',
    version: runtimeVersion,
  };
}

/**
 * Backward-compatible alias retained for existing integrations.
 */
export async function initializeWDKWorld(): Promise<void> {
  console.warn('[WDK] initializeWDKWorld is deprecated; using GaussFlow runtime bootstrap');
  await initializeGaussFlowRuntime();
}

/**
 * Backward-compatible alias retained for existing integrations.
 */
export function isWDKWorldAvailable(): boolean {
  return isGaussFlowRuntimeAvailable();
}

/**
 * Backward-compatible alias retained for existing integrations.
 */
export async function getWDKWorldStatus(): Promise<{
  available: boolean;
  type: string;
  jobPrefix?: string;
  concurrency?: number;
}> {
  const status = await getGaussFlowRuntimeStatus();
  return {
    available: status.available,
    type: status.type,
  };
}

export default {
  initializeGaussFlowRuntime,
  isGaussFlowRuntimeAvailable,
  getGaussFlowRuntimeStatus,
  initializeWDKWorld,
  isWDKWorldAvailable,
  getWDKWorldStatus,
};
