/**
 * Nested Manager Step
 *
 * Durable step for executing nested Manager agents via child workflows.
 * Pipes child stream to parent for unified progress.
 *
 * Follows Single Responsibility Principle.
 *
 * @since v4.1
 */

import { FatalError } from '../../workflow-shim';
import type { UIMessageChunk } from 'ai';
import type { ProgressField } from '../../types';
import { startCompatRun } from '../../runtime-compat';

// Forward reference - will be resolved at runtime
// This avoids circular dependency issues
type AgentWorkflowFn = (params: {
  agentId: string;
  basePath: string;
  inputJson: string;
  userId?: string;
  executionId: string;
}) => Promise<{ success: boolean; output?: unknown; error?: { message: string } }>;

/**
 * Execute a nested Manager agent by launching a child workflow.
 * Pipes the child stream to the parent for unified progress.
 *
 * WDK Configuration:
 * - maxRetries: 1 (child workflow has its own retry logic)
 */
export async function executeNestedManagerStep(
  parentWritable: WritableStream<UIMessageChunk>,
  agentId: string,
  basePath: string,
  inputJson: string,
  userId: string,
  parentExecutionId: string,
  agentWorkflow: AgentWorkflowFn
): Promise<unknown> {
  'use step';

  console.log(`[NestedManagerStep] Starting nested Manager: ${agentId}`);

  // Start child workflow
  const childRun = await startCompatRun(agentWorkflow, [
    {
      agentId,
      basePath,
      inputJson,
      userId,
      executionId: `${parentExecutionId}-${agentId.replace(/\//g, '-')}`,
    },
  ]);

  console.log(
    `[NestedManagerStep] Nested Manager ${agentId} started with runId: ${childRun.runId}`
  );

  // Pipe child stream to parent stream (unified progress)
  const childReadable = childRun.getReadable<UIMessageChunk>();
  const childReader = childReadable.getReader();
  const parentWriter = parentWritable.getWriter();

  try {
    // Read chunks from child stream and write to parent
    while (true) {
      const { done, value: chunk } = await childReader.read();
      if (done) break;

      // Prefix child progress with agent context
      if (chunk.type === 'data-progress' && chunk.data && typeof chunk.data === 'object') {
        const data = chunk.data as ProgressField;
        data.step = `${agentId}:${data.step}`;
      }
      await parentWriter.write(chunk);
    }
  } finally {
    childReader.releaseLock();
    parentWriter.releaseLock();
  }

  // Wait for result using returnValue (WDK Run API)
  const result = await childRun.returnValue;

  if (!result.success) {
    throw new FatalError(`Nested manager ${agentId} failed: ${result.error?.message}`);
  }

  console.log(`[NestedManagerStep] Nested Manager ${agentId} completed successfully`);
  return result.output;
}

// Child workflow has its own retry logic
Object.defineProperty(executeNestedManagerStep, 'maxRetries', { value: 1, writable: false });
