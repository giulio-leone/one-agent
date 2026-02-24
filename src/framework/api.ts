/**
 * OneAgent SDK v4.1 - API Helpers
 *
 * Server-side utilities for Next.js API routes.
 * Provides streaming responses for durable agent execution.
 *
 * @since v4.1
 * @package @giulio-leone/one-agent/api
 */

import type { ProgressField, UIProgressEvent } from './types';
import {
  startCompatRun,
  getCompatRunFromApi,
  classifyCompatRunError,
  type CompatRunHandle,
} from './runtime-compat';

export type AgentDurableRunHandle = CompatRunHandle;

export interface StartAgentDurableRunParams {
  agentId: string;
  input: unknown;
  userId: string;
  basePath?: string;
  executionId?: string;
}

export async function startAgentDurableRun(
  params: StartAgentDurableRunParams
): Promise<AgentDurableRunHandle> {
  const {
    agentId,
    input,
    userId,
    basePath = process.cwd(),
    executionId = crypto.randomUUID(),
  } = params;
  const { agentWorkflow } = await import('./agent-workflow');

  return (await startCompatRun(agentWorkflow, [
    {
      agentId,
      basePath,
      inputJson: JSON.stringify(input),
      userId,
      executionId,
    },
  ])) as CompatRunHandle;
}

export async function getAgentDurableRun(runId: string): Promise<AgentDurableRunHandle> {
  return getCompatRunFromApi(runId);
}

export async function classifyDurableRunError(
  error: unknown
): Promise<'not-completed' | 'failed' | 'unknown'> {
  return classifyCompatRunError(error);
}

/**
 * Parameters for createAgentDurableResponse
 */
export interface CreateAgentDurableResponseParams {
  /** Agent ID (e.g., "flight-search") */
  agentId: string;
  /** Input data for the agent */
  input: unknown;
  /** User ID for context and authorization */
  userId: string;
  /** Base path where sdk-agents/ directory lives (default: process.cwd()) */
  basePath?: string;
  /** Additional headers to include in response */
  headers?: Record<string, string>;
}

/**
 * Create a streaming SSE response for durable agent execution.
 *
 * This function:
 * 1. Starts a WDK workflow for the agent
 * 2. Streams progress events via SSE
 * 3. Returns final result when complete
 *
 * @example
 * ```typescript
 * // app/api/flight/smart-search/stream/route.ts
 * import { createAgentDurableResponse } from '@giulio-leone/one-agent/api';
 *
 * export async function POST(req: Request) {
 *   const { input } = await req.json();
 *   const userId = await getAuthUserId(req);
 *
 *   return createAgentDurableResponse({
 *     agentId: 'flight-search',
 *     input,
 *     userId,
 *   });
 * }
 * ```
 */
export async function createAgentDurableResponse(
  params: CreateAgentDurableResponseParams
): Promise<Response> {
  const { agentId, input, userId, basePath = process.cwd(), headers = {} } = params;

  try {
    // Runtime-start abstraction (internally supports legacy workflow runtime today).
    const executionId = crypto.randomUUID();
    const run = await startAgentDurableRun({
      agentId,
      input,
      userId,
      basePath,
      executionId,
    });

    // Create SSE stream that reads from WDK and formats for frontend
    const sseStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const reader = run.readable.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Format as SSE event
            const sseData = `data: ${JSON.stringify(value)}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          }

          // Send done signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          console.error('[SSE] Stream error:', error);
          const errorData = `data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        } finally {
          controller.close();
        }
      },
    });

    // Build response headers
    // Note: Using lowercase for consistency with HTTP/2 and browser handling
    const responseHeaders = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'x-workflow-run-id': run.runId,
      'x-execution-id': executionId,
    });

    for (const [key, value] of Object.entries(headers)) {
      responseHeaders.set(key, value);
    }

    return new Response(sseStream, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Check for missing workflow runtime packages
    if (message.includes("Cannot find module '@workflow")) {
      return new Response(
        JSON.stringify({
          error: 'Workflow runtime packages not installed',
          details:
            'Install @workflow/core (legacy) or @giulio-leone/gaussflow-agent (recommended) for durable streaming.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to start agent stream',
        details: message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Create a simple SSE stream for non-durable agent execution.
 *
 * Use this when WDK is not required but you still want streaming.
 * Falls back to callback-based progress emission.
 *
 * @example
 * ```typescript
 * // For simpler use cases without WDK durability
 * export async function POST(req: Request) {
 *   const { input } = await req.json();
 *
 *   return createAgentStreamResponse({
 *     agentId: 'my-agent',
 *     input,
 *     userId: 'user-123',
 *   });
 * }
 * ```
 */
export async function createAgentStreamResponse(
  params: CreateAgentDurableResponseParams
): Promise<Response> {
  const { agentId, input, userId, basePath = process.cwd() } = params;

  // Create a TransformStream for SSE
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Helper to write SSE event
  const writeEvent = async (event: UIProgressEvent | { type: string; data: unknown }) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };

  // Start agent execution in background
  (async () => {
    try {
      const { execute } = await import('./engine');

      await execute(agentId, input, {
        userId,
        basePath,
        onProgress: async (event) => {
          const progressEvent: UIProgressEvent = {
            type: 'data-progress',
            data: {
              step: event.step,
              userMessage: event.message,
              estimatedProgress: event.progress,
              adminDetails: event.data ? JSON.stringify(event.data) : undefined,
            },
            transient: true,
          };
          await writeEvent(progressEvent);
        },
      });

      // Signal completion
      await writeEvent({ type: 'finish', data: { complete: true } });
    } catch (error) {
      await writeEvent({
        type: 'error',
        data: { message: error instanceof Error ? error.message : String(error) },
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * Helper to create a UIProgressEvent for manual streaming.
 *
 * @example
 * ```typescript
 * const event = createProgressEvent({
 *   step: 'tool:searchFlights',
 *   userMessage: 'Searching flights...',
 *   estimatedProgress: 30,
 * });
 * writer.write(event);
 * ```
 */
export function createProgressEvent(
  progress: Partial<ProgressField> & { step: string }
): UIProgressEvent {
  return {
    type: 'data-progress',
    data: {
      step: progress.step,
      userMessage: progress.userMessage || progress.step,
      estimatedProgress: progress.estimatedProgress ?? 0,
      adminDetails: progress.adminDetails,
      iconHint: progress.iconHint,
      toolName: progress.toolName,
    },
    transient: true,
  };
}
