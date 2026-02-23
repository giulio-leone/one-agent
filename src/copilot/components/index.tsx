'use client';

import { CopilotButton } from './copilot-button';

/**
 * Main Copilot Widget Component
 * Include this in your application layout
 *
 * NOTE: CopilotWindow è stato rimosso - usa CopilotSidebar invece
 */
export function CopilotWidget() {
  return (
    <>
      <CopilotButton />
    </>
  );
}

// Export sub-components for custom compositions
export { CopilotButton } from './copilot-button';
