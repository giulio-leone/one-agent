/**
 * Transform Step
 *
 * Durable step for executing Transform functions (pure TypeScript, no LLM).
 * Follows Single Responsibility Principle.
 *
 * @since v4.1
 */

import { FatalError } from '../../workflow-shim';

/**
 * Execute a Transform step (pure TypeScript function, no LLM).
 *
 * WDK Configuration:
 * - maxRetries: 0 (transforms are deterministic, no retry needed)
 */
export async function executeTransformStep(
  transformId: string,
  inputJson: string
): Promise<unknown> {
  'use step';

  const { getTransform, getRegisteredTransformKeys } = await import('../../registry');
  const transformFn = getTransform(transformId);

  if (!transformFn) {
    const available = getRegisteredTransformKeys().join(', ') || 'none';
    throw new FatalError(
      `Transform "${transformId}" not found in registry. Available: ${available}`
    );
  }

  const input = JSON.parse(inputJson);
  return Promise.resolve(transformFn(input));
}

// Transforms are deterministic, no retry needed
Object.defineProperty(executeTransformStep, 'maxRetries', { value: 0, writable: false });
