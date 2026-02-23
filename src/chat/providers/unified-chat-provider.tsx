/**
 * Unified Chat Provider
 *
 * React Context provider che unifica Chat e Copilot:
 * - Gestione feature flags da admin
 * - Screen context automatico
 * - Model selection (synced with Zustand AI Models store)
 * - User credits/role
 *
 * PRINCIPI: KISS, SOLID, DRY
 */

'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type {
  UnifiedChatContextValue,
  UnifiedChatProviderProps,
  ScreenContextData,
} from '../types/unified-chat';
import { DEFAULT_CHAT_FEATURES } from '../types/unified-chat';
import {
  useAIModelsStore,
  selectSelectedModelId,
  selectModels,
} from '@giulio-leone/lib-stores';

// ============================================================================
// Context
// ============================================================================

const UnifiedChatContext = createContext<UnifiedChatContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

/**
 * UnifiedChatProvider - Context provider globale per Chat unificata
 *
 * Fornisce:
 * - Feature flags da admin config
 * - Modelli AI disponibili
 * - Screen context corrente
 * - User info (role, credits)
 * - Open state per sidebar/floating
 *
 * NOTE: Model selection is now synced with Zustand AI Models store (SSOT)
 */
export function UnifiedChatProvider({
  children,
  userId,
  userRole = 'USER',
  userCredits = 0,
  features = DEFAULT_CHAT_FEATURES,
  models = [],
  defaultModel = null,
  initialContext,
}: UnifiedChatProviderProps) {
  // Zustand store for AI models (SSOT)
  const storeSelectedModelId = useAIModelsStore(selectSelectedModelId);
  const storeModels = useAIModelsStore(selectModels);
  const { setModels: storeSetModels, selectModel: storeSelectModel } = useAIModelsStore();

  // Initialize store with models from props
  useEffect(() => {
    if (models && models.length > 0) {
      storeSetModels(models);
      // Only set default if store has no selection
      if (!storeSelectedModelId) {
        if (defaultModel?.id) {
          storeSelectModel(defaultModel.id);
        } else if (models[0]?.id) {
          storeSelectModel(models[0].id);
        }
      }
    }
  }, [models, defaultModel, storeSetModels, storeSelectModel, storeSelectedModelId]);

  // Screen context and open state (local)
  const [screenContext, setScreenContextState] = useState<ScreenContextData | null>(
    initialContext || null
  );
  const [isOpen, setIsOpenState] = useState(false);

  // Use store for selectedModel (synced with Zustand)
  const selectedModel = storeSelectedModelId || defaultModel?.id || models[0]?.id || null;

  // Actions - sync with Zustand store
  const setSelectedModel = useCallback((modelId: string) => {
    storeSelectModel(modelId);
  }, [storeSelectModel]);

  const setScreenContext = useCallback((context: ScreenContextData | null) => {
    setScreenContextState(context);
  }, []);

  const setIsOpen = useCallback((open: boolean) => {
    setIsOpenState(open);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpenState((prev) => !prev);
  }, []);

  // Use models from store if available, fallback to props
  const effectiveModels = storeModels.length > 0 ? storeModels : models;

  // Memoize context value
  const contextValue = useMemo<UnifiedChatContextValue>(
    () => ({
      // State
      userId,
      userRole,
      userCredits,
      features,
      models: effectiveModels,
      defaultModel,
      selectedModel,
      screenContext,
      isOpen,
      // Actions
      setSelectedModel,
      setScreenContext,
      setIsOpen,
      toggleOpen,
    }),
    [
      userId,
      userRole,
      userCredits,
      features,
      effectiveModels,
      defaultModel,
      selectedModel,
      screenContext,
      isOpen,
      setSelectedModel,
      setScreenContext,
      setIsOpen,
      toggleOpen,
    ]
  );

  return <UnifiedChatContext.Provider value={contextValue}>{children}</UnifiedChatContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useUnifiedChatContext - Access UnifiedChat context
 *
 * @throws Error if used outside UnifiedChatProvider
 */
export function useUnifiedChatContext(): UnifiedChatContextValue {
  const context = useContext(UnifiedChatContext);
  if (!context) {
    throw new Error('useUnifiedChatContext must be used within UnifiedChatProvider');
  }
  return context;
}

/**
 * useUnifiedChatContextSafe - Access UnifiedChat context without throwing
 *
 * Returns null if outside provider (useful for optional contexts)
 */
export function useUnifiedChatContextSafe(): UnifiedChatContextValue | null {
  return useContext(UnifiedChatContext);
}

