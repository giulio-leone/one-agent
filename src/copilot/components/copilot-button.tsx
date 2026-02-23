'use client';

import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore, useAuthStore } from '@giulio-leone/lib-stores';
import { cn } from '@giulio-leone/lib-design-system';

export function CopilotButton() {
  const { copilotVisible, toggleCopilot } = useUIStore();
  const user = useAuthStore((state) => state.user);

  // Se l'utente ha disabilitato il copilot, non mostrare il bottone
  if (user?.copilotEnabled === false) {
    return null;
  }

  // Quando Copilot è aperto, nascondiamo il FAB (la X è già nell'header del Copilot)
  if (copilotVisible) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-[9999] sm:right-6 sm:bottom-6">
      <AnimatePresence mode="wait">
        {!copilotVisible && (
          <motion.button
            key="open"
            initial={{ scale: 0, rotate: 90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: -90 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleCopilot}
            className={cn(
              'group relative flex h-14 w-14 items-center justify-center rounded-2xl',
              // Premium gradient
              'from-primary-500 bg-gradient-to-br via-violet-500 to-purple-600',
              'shadow-primary-500/30 shadow-xl',
              'hover:shadow-primary-500/40 hover:shadow-2xl',
              'transition-all duration-300'
            )}
            aria-label="Apri Copilot AI"
          >
            {/* Pulse animation */}
            <span
              className={cn(
                'absolute inset-0 -z-10 rounded-2xl',
                'from-primary-500 bg-gradient-to-br via-violet-500 to-purple-600',
                'animate-ping opacity-30'
              )}
            />

            {/* Glow effect */}
            <span
              className={cn(
                'absolute inset-0 -z-20 rounded-2xl blur-xl',
                'from-primary-400 bg-gradient-to-br via-violet-400 to-purple-500',
                'opacity-50 transition-opacity duration-300 group-hover:opacity-75'
              )}
            />

            <Sparkles
              size={26}
              className={cn(
                'text-white',
                'transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12'
              )}
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
