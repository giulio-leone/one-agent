/**
 * useAdminMode - React hook for admin/debug mode toggle
 *
 * Persists state to localStorage for consistency across sessions.
 * Used to show/hide technical details in agent progress UI.
 *
 * @example
 * ```tsx
 * const { isAdmin, toggle } = useAdminMode();
 *
 * return (
 *   <>
 *     <Switch checked={isAdmin} onCheckedChange={toggle} />
 *     {isAdmin && <pre>{event.adminDetails}</pre>}
 *   </>
 * );
 * ```
 *
 * @package @giulio-leone/one-agent/hooks
 */

import { useState, useCallback, useEffect } from 'react';
import type { AdminModeState } from './types';

const STORAGE_KEY = 'oneagent-admin-mode';

/**
 * Hook for managing admin/debug mode state.
 *
 * @param defaultValue - Initial value if not in localStorage (default: false)
 */
export function useAdminMode(defaultValue = false): AdminModeState {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    // SSR safety: check if window exists
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== null ? stored === 'true' : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  // Sync to localStorage on change
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, String(isAdmin));
    } catch {
      // Ignore localStorage errors (e.g., private browsing)
    }
  }, [isAdmin]);

  const toggle = useCallback(() => {
    setIsAdmin((prev) => !prev);
  }, []);

  const enable = useCallback(() => {
    setIsAdmin(true);
  }, []);

  const disable = useCallback(() => {
    setIsAdmin(false);
  }, []);

  return {
    isAdmin,
    toggle,
    enable,
    disable,
  };
}

export default useAdminMode;
