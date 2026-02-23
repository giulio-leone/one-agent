/**
 * useAgentStream - React hook for streaming agent execution
 *
 * Consumes SSE stream from OneAgent SDK 4.1 durable agents.
 * Provides real-time progress updates and final results.
 *
 * @example
 * ```tsx
 * const { execute, progress, userMessage, result, isLoading } = useAgentStream<
 *   FlightSearchResult,
 *   FlightSearchInput
 * >('/api/flight/smart-search/stream');
 *
 * // Execute search
 * await execute({ flyFrom: ['FCO'], flyTo: ['CDG'], ... });
 *
 * // UI updates in real-time via progress, userMessage, events
 * ```
 *
 * @package @giulio-leone/one-agent/hooks
 */

import { useCallback, useState, useRef } from 'react';
import type {
  ProgressField,
  AgentStreamState,
  UseAgentStreamOptions,
  UseAgentStreamReturn,
} from './types';

const INITIAL_STATE = <TOutput>(): AgentStreamState<TOutput> => ({
  status: 'idle',
  progress: 0,
  currentStep: '',
  userMessage: '',
  events: [],
  result: null,
  error: null,
  runId: null,
});

/**
 * Hook for streaming agent execution with real-time progress.
 *
 * @param endpoint - API endpoint that returns SSE stream
 * @param options - Configuration options
 */
export function useAgentStream<TOutput, TInput = unknown>(
  endpoint: string,
  options: UseAgentStreamOptions = {}
): UseAgentStreamReturn<TOutput, TInput> {
  const { maxEvents = 50, autoRetry = false, maxRetries = 3 } = options;

  const [state, setState] = useState<AgentStreamState<TOutput>>(INITIAL_STATE<TOutput>);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    retryCountRef.current = 0;
    setState(INITIAL_STATE<TOutput>);
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setState((prev) => ({
      ...prev,
      status: 'idle',
      userMessage: 'Cancelled',
    }));
  }, []);

  const execute = useCallback(
    async (input: TInput) => {
      // Abort any existing request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setState((prev) => ({
        ...prev,
        status: 'connecting',
        progress: 0,
        currentStep: 'init',
        userMessage: 'Connecting...',
        events: [],
        result: null,
        error: null,
      }));

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        // Extract runId from headers if available (lowercase for HTTP/2 compatibility)
        const runId = response.headers.get('x-workflow-run-id');
        if (runId) {
          setState((prev) => ({ ...prev, runId }));
        }

        setState((prev) => ({ ...prev, status: 'streaming' }));

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');

          // Keep incomplete line in buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            // Handle SSE format: "data: {...}"
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6);
                if (jsonStr === '[DONE]') {
                  continue;
                }

                const event = JSON.parse(jsonStr);

                // Handle different event types
                if (event.type === 'data-progress' || event.type === 'ai_progress') {
                  const progressData = event.data as ProgressField;
                  setState((prev) => ({
                    ...prev,
                    progress: progressData.estimatedProgress,
                    currentStep: progressData.step,
                    userMessage: progressData.userMessage,
                    events: [...prev.events.slice(-(maxEvents - 1)), progressData],
                  }));
                } else if (event.type === 'finish' || event.type === 'agent_complete') {
                  setState((prev) => ({
                    ...prev,
                    status: 'complete',
                    progress: 100,
                    userMessage: 'Complete!',
                    result: (event.output || event.data?.output) as TOutput,
                  }));
                } else if (event.type === 'error') {
                  throw new Error(event.data?.message || event.error || 'Unknown error');
                }
              } catch (parseError) {
                // Ignore parse errors for incomplete JSON chunks
                console.warn('[useAgentStream] Parse error:', parseError);
              }
            }
          }
        }

        // If we reach here without a result, check if we need to handle the final state
        setState((prev) => {
          if (prev.status === 'streaming' && !prev.result) {
            return {
              ...prev,
              status: 'complete',
              progress: 100,
            };
          }
          return prev;
        });

        retryCountRef.current = 0;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Auto-retry logic
        if (autoRetry && retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          console.warn(
            `[useAgentStream] Retry ${retryCountRef.current}/${maxRetries}:`,
            errorMessage
          );
          // Exponential backoff
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retryCountRef.current - 1)));
          return execute(input);
        }

        setState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMessage,
          userMessage: 'Error occurred',
        }));
      }
    },
    [endpoint, maxEvents, autoRetry, maxRetries]
  );

  const latestEvent: ProgressField | null =
    state.events.length > 0 ? (state.events[state.events.length - 1] ?? null) : null;

  return {
    ...state,
    execute,
    abort,
    reset,
    isLoading: state.status === 'connecting' || state.status === 'streaming',
    latestEvent,
  };
}

export default useAgentStream;
