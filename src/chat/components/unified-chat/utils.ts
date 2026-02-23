/**
 * Utility for class name merging
 * Simple cn function without external dependencies
 */

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
