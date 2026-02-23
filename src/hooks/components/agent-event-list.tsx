'use client';

/**
 * AgentEventList - Reusable component for displaying agent streaming events
 *
 * Shows a timeline of events with icons, user messages, and optional admin details.
 * Fully compatible with OneAgent SDK 4.1 streaming architecture.
 *
 * @example
 * ```tsx
 * import { AgentEventList, useAdminMode } from '@giulio-leone/one-agent/hooks';
 *
 * const { isAdmin, toggle } = useAdminMode();
 *
 * <AgentEventList
 *   events={events}
 *   isAdmin={isAdmin}
 *   onToggleAdmin={toggle}
 *   maxVisible={5}
 * />
 * ```
 *
 * @package @giulio-leone/one-agent/hooks
 */

import * as React from 'react';
import type { ProgressField } from '../types';

// ==================== TYPES ====================

export type IconHint =
  | 'search'
  | 'analyze'
  | 'compare'
  | 'filter'
  | 'loading'
  | 'success'
  | 'error';

export interface AgentEventListProps {
  /** Events to display */
  events: ProgressField[];
  /** Whether to show admin details */
  isAdmin?: boolean;
  /** Toggle admin mode callback */
  onToggleAdmin?: () => void;
  /** Maximum events to show (default: all) */
  maxVisible?: number;
  /** Show admin toggle button */
  showAdminToggle?: boolean;
  /** Additional class names */
  className?: string;
  /** Compact mode - single line per event */
  compact?: boolean;
  /** Show timestamps */
  showTimestamps?: boolean;
  /** Custom icon renderer */
  renderIcon?: (iconHint: IconHint | undefined) => React.ReactNode;
}

// ==================== ICON COMPONENTS ====================

/**
 * Default SVG icons for event types
 */
const Icons = {
  search: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  ),
  analyze: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  ),
  compare: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  ),
  filter: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
      />
    </svg>
  ),
  loading: (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  ),
  success: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  default: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
};

/**
 * Get icon color based on hint
 */
function getIconColor(iconHint: IconHint | undefined): string {
  switch (iconHint) {
    case 'success':
      return 'text-emerald-500';
    case 'error':
      return 'text-red-500';
    case 'loading':
      return 'text-blue-500';
    case 'search':
      return 'text-violet-500';
    case 'analyze':
      return 'text-amber-500';
    case 'compare':
      return 'text-cyan-500';
    case 'filter':
      return 'text-indigo-500';
    default:
      return 'text-slate-400';
  }
}

/**
 * Get icon background color based on hint
 */
function getIconBgColor(iconHint: IconHint | undefined): string {
  switch (iconHint) {
    case 'success':
      return 'bg-emerald-500/10';
    case 'error':
      return 'bg-red-500/10';
    case 'loading':
      return 'bg-blue-500/10';
    case 'search':
      return 'bg-violet-500/10';
    case 'analyze':
      return 'bg-amber-500/10';
    case 'compare':
      return 'bg-cyan-500/10';
    case 'filter':
      return 'bg-indigo-500/10';
    default:
      return 'bg-slate-500/10';
  }
}

// ==================== COMPONENT ====================

/**
 * AgentEventList Component
 *
 * Displays a timeline of streaming events from an AI agent.
 * Supports admin mode for showing technical details.
 */
export function AgentEventList({
  events,
  isAdmin = false,
  onToggleAdmin,
  maxVisible,
  showAdminToggle = true,
  className = '',
  compact = false,
  showTimestamps = false,
  renderIcon,
}: AgentEventListProps) {
  // Determine visible events
  const visibleEvents = React.useMemo(() => {
    if (!maxVisible || maxVisible >= events.length) {
      return events;
    }
    // Show last N events
    return events.slice(-maxVisible);
  }, [events, maxVisible]);

  const hiddenCount = events.length - visibleEvents.length;

  // Default icon renderer
  const defaultRenderIcon = React.useCallback((iconHint: IconHint | undefined) => {
    const icon = Icons[iconHint || 'default'] || Icons.default;
    return icon;
  }, []);

  const iconRenderer = renderIcon || defaultRenderIcon;

  if (events.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with admin toggle */}
      {showAdminToggle && onToggleAdmin && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">Activity</span>
          <button
            type="button"
            onClick={onToggleAdmin}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              isAdmin
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'bg-slate-500/10 text-slate-500 hover:bg-slate-500/20'
            } `}
          >
            {isAdmin ? 'Admin' : 'User'}
          </button>
        </div>
      )}

      {/* Hidden events indicator */}
      {hiddenCount > 0 && (
        <div className="text-muted-foreground text-center text-xs">
          {hiddenCount} earlier {hiddenCount === 1 ? 'event' : 'events'} hidden
        </div>
      )}

      {/* Event list */}
      <div className={compact ? 'space-y-1' : 'space-y-2'}>
        {visibleEvents.map((event, index) => (
          <EventItem
            key={`${event.step}-${index}`}
            event={event}
            isAdmin={isAdmin}
            compact={compact}
            showTimestamp={showTimestamps}
            renderIcon={iconRenderer}
            isLatest={index === visibleEvents.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

// ==================== EVENT ITEM ====================

interface EventItemProps {
  event: ProgressField;
  isAdmin: boolean;
  compact: boolean;
  showTimestamp: boolean;
  renderIcon: (iconHint: IconHint | undefined) => React.ReactNode;
  isLatest: boolean;
}

function EventItem({
  event,
  isAdmin,
  compact,
  showTimestamp,
  renderIcon,
  isLatest,
}: EventItemProps) {
  const iconColor = getIconColor(event.iconHint as IconHint);
  const iconBgColor = getIconBgColor(event.iconHint as IconHint);

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 text-sm ${isLatest ? 'text-foreground' : 'text-muted-foreground'} `}
      >
        <span className={`${iconColor}`}>{renderIcon(event.iconHint as IconHint)}</span>
        <span className="truncate">{event.userMessage}</span>
        {event.estimatedProgress > 0 && (
          <span className="text-muted-foreground ml-auto text-xs">
            {Math.round(event.estimatedProgress)}%
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex gap-3 rounded-lg p-2 transition-colors ${isLatest ? 'bg-primary/5 border-primary/20 border' : 'bg-muted/30'} `}
    >
      {/* Icon */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBgColor} ${iconColor} `}
      >
        {renderIcon(event.iconHint as IconHint)}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-sm leading-snug ${isLatest ? 'text-foreground font-medium' : 'text-muted-foreground'} `}
          >
            {event.userMessage}
          </p>
          {event.estimatedProgress > 0 && (
            <span
              className={`shrink-0 text-xs font-medium ${isLatest ? 'text-primary' : 'text-muted-foreground'} `}
            >
              {Math.round(event.estimatedProgress)}%
            </span>
          )}
        </div>

        {/* Admin details */}
        {isAdmin && event.adminDetails && (
          <pre className="text-muted-foreground mt-1.5 overflow-x-auto rounded bg-slate-900/50 p-2 font-mono text-xs leading-relaxed dark:bg-slate-950/50">
            {event.adminDetails}
          </pre>
        )}

        {/* Tool name badge */}
        {isAdmin && event.toolName && (
          <span className="mt-1.5 inline-flex items-center rounded bg-violet-500/10 px-1.5 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
            {event.toolName}
          </span>
        )}

        {/* Timestamp */}
        {showTimestamp && (
          <p className="text-muted-foreground mt-1 text-xs">{new Date().toLocaleTimeString()}</p>
        )}
      </div>
    </div>
  );
}

export default AgentEventList;
