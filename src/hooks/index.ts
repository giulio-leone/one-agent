/**
 * @onecoach/one-agent/hooks
 *
 * Shared hooks and UI components for agent integration.
 * Re-exports ProgressField from agent-contracts.
 */

'use client';

import type { ProgressField } from '@giulio-leone/agent-contracts';

export type { ProgressField };

// ── AgentEventList ──

export interface AgentEventListProps {
  events?: Array<{
    step: string;
    userMessage: string;
    percent?: number;
    data?: unknown;
  }>;
  className?: string;
}

/**
 * AgentEventList - renders a list of agent progress events.
 * TODO: Implement full UI with streaming progress visualization.
 */
export function AgentEventList(_props: AgentEventListProps): null {
  return null;
}

// ── useAdminMode ──

/**
 * useAdminMode - hook to toggle admin/debug mode for agent UIs.
 * TODO: Implement with auth store integration.
 */
export function useAdminMode(): { isAdmin: boolean; toggleAdmin: () => void } {
  return {
    isAdmin: false,
    toggleAdmin: () => {},
  };
}
