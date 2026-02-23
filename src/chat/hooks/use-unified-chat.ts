/**
 * useUnifiedChat Hook
 *
 * Hook unificato per Chat e Copilot che combina:
 * - useChatCore per logica AI
 * - Screen context automatico
 * - Feature flags da admin
 * - Conversation management
 * - Model selection
 *
 * PRINCIPI: KISS, SOLID, DRY
 */

'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { UIMessage } from '@ai-sdk/react';
import { useChatCore } from './use-chat-core';
import { useUnifiedChatContextSafe } from '../providers/unified-chat-provider';
import type { UseUnifiedChatOptions, UseUnifiedChatResult, QueuedMessage } from '../types/unified-chat';
import { DEFAULT_CHAT_FEATURES } from '../types/unified-chat';
import { logger } from '@giulio-leone/lib-core';
import {
  useAIModelsStore,
  selectSelectedModelName,
  selectModels,
  selectSelectedModelId,
  useChatStore,
  selectConversations,
  selectCurrentConversationId,
  useCopilotActiveContextStore,
} from '@giulio-leone/lib-stores';

// Note: Status-based notification doesn't require parsing tool result structures
// The active context already has the resource IDs we need

// ============================================================================
// Hook
// ============================================================================

/**
 * useUnifiedChat - Hook unificato per Chat e Copilot
 *
 * Fornisce tutte le funzionalità di Chat in qualsiasi contesto:
 * - Messaggi e input
 * - Conversazioni persistenti
 * - Screen context automatico
 * - Feature flags da admin
 * - Model selection
 *
 * @example
 * ```tsx
 * // In Chat fullscreen
 * const chat = useUnifiedChat({ mode: 'fullscreen' });
 *
 * // In Copilot sidebar
 * const copilot = useUnifiedChat({
 *   mode: 'sidebar',
 *   contextOverride: { type: 'workout', entityId: workoutId }
 * });
 * ```
 */
export function useUnifiedChat(options: UseUnifiedChatOptions = {}): UseUnifiedChatResult {
  const {
    mode = 'sidebar',
    contextOverride,
    conversationId: initialConversationId = null,
    initialConversations = [],
    onContextUpdate,
    reasoningEnabled = true,
    initialModelId,
  } = options;

  // Try to get context from provider (may be null if not in provider)
  const providerContext = useUnifiedChatContextSafe();

  // Use Zustand ChatStore (SSOT) - aggiornato via Supabase Realtime
  const chatStoreConversations = useChatStore(selectConversations);
  const chatStoreCurrentConversationId = useChatStore(selectCurrentConversationId);
  const chatStoreSetCurrentConversation = useChatStore((state) => state.setCurrentConversation);
  const chatStoreDeleteConversation = useChatStore((state) => state.deleteConversation);
  const chatStoreDeleteConversations = useChatStore((state) => state.deleteConversations);
  const chatStoreDeleteAllConversations = useChatStore((state) => state.deleteAllConversations);
  const chatStoreRenameConversation = useChatStore((state) => state.renameConversation);
  const chatStoreIsDeleting = useChatStore((state) => state.isDeleting);

  // Local state fallbacks when not in provider
  const [localIsOpen, setLocalIsOpen] = useState(false);
  
  // Message queue state for concurrent messages
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
  const isProcessingQueueRef = useRef(false);

  // Use Zustand store for AI models (SSOT)
  const storeModels = useAIModelsStore(selectModels);
  const selectedModelId = useAIModelsStore(selectSelectedModelId);
  const selectedModelName = useAIModelsStore(selectSelectedModelName);
  const { selectModel: storeSelectModel, setModels: storeSetModels } = useAIModelsStore();

  // Initialize store with models from provider if available
  useEffect(() => {
    if (providerContext?.models && providerContext.models.length > 0) {
      storeSetModels(providerContext.models);
    }
    if (initialModelId && !selectedModelId) {
      storeSelectModel(initialModelId);
    }
  }, [providerContext?.models, initialModelId, selectedModelId, storeSetModels, storeSelectModel]);

  // Determine effective values (provider or local)
  const screenContext = contextOverride || providerContext?.screenContext || null;
  const features = providerContext?.features || DEFAULT_CHAT_FEATURES;
  const models = storeModels.length > 0 ? storeModels : (providerContext?.models || []);
  const selectedModel = selectedModelId || models[0]?.id || null;
  const userRole = providerContext?.userRole || 'USER';
  const userCredits = providerContext?.userCredits || 0;
  const userId = providerContext?.userId || null;
  const isOpen = providerContext?.isOpen ?? localIsOpen;

  // Track new conversation ID from response (per evitare aggiornamenti durante render)
  // Dichiarato qui per essere disponibile prima del suo utilizzo
  const [newConversationId, setNewConversationId] = useState<string | null>(null);
  
  // Conversations state - usa ChatStore (SSOT) aggiornato via Realtime
  // Fallback a initialConversations solo al primo mount se lo store è vuoto
  // Cast necessario perché ChatStore usa domain?: string mentre lib-chat-core usa domain?: ChatDomain
  const conversations = (chatStoreConversations.length > 0 
    ? chatStoreConversations 
    : initialConversations) as typeof initialConversations;
  
  // IMPORTANTE: Per evitare reset dei messaggi quando viene creato un nuovo conversationId,
  // manteniamo il conversationId stabile durante una sessione attiva
  // Il nuovo ID viene gestito tramite il body della richiesta invece
  const stableConversationIdRef = useRef<string | null>(initialConversationId || null);
  
  // Aggiorna stableConversationIdRef solo quando cambia da null a un valore (nuova conversazione)
  // ma non quando cambia da un valore a un altro (per evitare reset durante la sessione)
  useEffect(() => {
    const newId = newConversationId || chatStoreCurrentConversationId || initialConversationId;
    if (newId && !stableConversationIdRef.current) {
      stableConversationIdRef.current = newId;
    }
  }, [newConversationId, chatStoreCurrentConversationId, initialConversationId]);
  
  // Usa l'ID stabile per useChatCore, ma il nuovo ID viene comunque inviato nel body
  const currentConversation = stableConversationIdRef.current;

  // Build request body with screen context
  // Uses Zustand store selector for modelName (already converted from database ID)
  // IMPORTANTE: Include sempre il conversationId corrente (che può essere nuovo) nel body
  // anche se non lo passiamo a useChatCore per evitare reset dei messaggi
  // CONTEXT-AWARE: Legge activeContext dal nuovo CopilotActiveContextStore per contesto granulare
  // Usiamo i singoli selettori invece di selectMcpActiveContext per evitare re-render infiniti
  const domain = useCopilotActiveContextStore((s) => s.domain);
  const workoutContext = useCopilotActiveContextStore((s) => s.workout);
  const nutritionContext = useCopilotActiveContextStore((s) => s.nutrition);
  const oneAgendaContext = useCopilotActiveContextStore((s) => s.oneAgenda);
  const liveSessionContext = useCopilotActiveContextStore((s) => s.liveSession);

  const requestBody = useMemo(() => {
    const body: Record<string, unknown> = {
      tier: 'balanced',
      enableTools: true,
      reasoning: reasoningEnabled,
    };

    // Use selectedModelName from Zustand store (already the API model name)
    if (selectedModelName) {
      body.model = selectedModelName;
      logger.warn(`🎯 [useUnifiedChat] Sending model from store: ${selectedModelName}`);
    }

    // Add full active context from CopilotActiveContextStore
    // Maps new granular context to API format
    console.warn('[useUnifiedChat] 🔍 Reading context from store:', {
      domain,
      hasWorkout: !!workoutContext,
      hasNutrition: !!nutritionContext,
      hasOneAgenda: !!oneAgendaContext,
      hasLiveSession: !!liveSessionContext,
      liveSessionId: liveSessionContext?.sessionId ?? 'none',
    });
    
    if (domain) {
      body.domain = domain;
      
      // Build context object, only including non-null domain contexts
      const contextObj: Record<string, unknown> = { domain };
      
      // Workout context mapping (only if present)
      if (workoutContext) {
        contextObj.workout = {
          programId: workoutContext.programId,
          weekNumber: workoutContext.weekIndex !== null ? workoutContext.weekIndex + 1 : null,
          dayNumber: workoutContext.dayIndex !== null ? workoutContext.dayIndex + 1 : null,
          exerciseIndex: workoutContext.selectedExercise?.index ?? null,
          selectedExerciseName: workoutContext.selectedExercise?.name ?? null,
        };
      }
      
      // Nutrition context mapping (only if present)
      if (nutritionContext) {
        contextObj.nutrition = {
          planId: nutritionContext.planId,
          dayNumber: nutritionContext.dayIndex !== null ? nutritionContext.dayIndex + 1 : null,
          mealIndex: nutritionContext.selectedMeal?.index ?? null,
          selectedMealName: nutritionContext.selectedMeal?.name ?? null,
        };
      }
      
      // OneAgenda context mapping (only if present)
      if (oneAgendaContext) {
        contextObj.oneAgenda = {
          projectId: oneAgendaContext.projectId,
          taskId: oneAgendaContext.selectedTask?.id ?? null,
          selectedTaskTitle: oneAgendaContext.selectedTask?.title ?? null,
          milestoneId: oneAgendaContext.selectedMilestone?.id ?? null,
        };
      }
      
      // Live Session context mapping (for real-time AI coaching)
      if (liveSessionContext) {
        contextObj.liveSession = {
          sessionId: liveSessionContext.sessionId,
          programId: liveSessionContext.programId,
          status: liveSessionContext.status,
          isActive: liveSessionContext.status === 'active',
          currentExerciseName: liveSessionContext.currentExerciseName,
          currentExerciseIndex: liveSessionContext.currentExerciseIndex,
          currentSetIndex: liveSessionContext.currentSetIndex,
          completedSets: liveSessionContext.completedSets,
          totalSets: liveSessionContext.totalSets,
          lastSet: liveSessionContext.lastSet,
          restTimerRunning: liveSessionContext.restTimerRunning,
          restTimeRemaining: liveSessionContext.restTimeRemaining,
        };
        logger.info('[useUnifiedChat] 🏋️ Live session context:', {
          sessionId: liveSessionContext.sessionId,
          exercise: liveSessionContext.currentExerciseName,
          progress: `${liveSessionContext.completedSets}/${liveSessionContext.totalSets}`,
        });
      }
      
      body.context = contextObj;
      
      logger.info('[useUnifiedChat] 📍 Active context:', {
        domain,
        workout: workoutContext?.programId,
        nutrition: nutritionContext?.planId,
        oneAgenda: oneAgendaContext?.projectId,
      });
    } else if (screenContext) {
      // Fallback to basic screenContext for backward compatibility
      body.domain = screenContext.type;
      body.context = {
        type: screenContext.type,
        entityId: screenContext.entityId,
        entityType: screenContext.entityType,
        ...screenContext.data,
      };
    }

    // Include sempre il conversationId corrente (può essere nuovo) nel body
    // Questo permette al server di associare i messaggi alla conversazione corretta
    // anche se non passiamo l'id a useChatCore per evitare reset dei messaggi
    const effectiveConversationId = newConversationId || chatStoreCurrentConversationId || initialConversationId;
    if (effectiveConversationId) {
      body.conversationId = effectiveConversationId;
    }

    return body;
  }, [selectedModelName, domain, workoutContext, nutritionContext, oneAgendaContext, liveSessionContext, screenContext, reasoningEnabled, newConversationId, chatStoreCurrentConversationId, initialConversationId]);

  // Fetch conversations non più necessario - ChatStore viene aggiornato via Realtime
  // Mantenuto solo per retrocompatibilità se necessario

  // Track if we're waiting for a new conversation ID
  const pendingNewConversationRef = useRef(false);

  // Use chat core with unified body
  const {
    messages,
    input,
    setInput: setCoreInput,
    sendMessage: coreSendMessage,
    setMessages: setCoreMessages,
    status,
    isLoading,
    error,
    stop,
    reload: coreReload,
    reset: resetCore,
  } = useChatCore({
    api: '/api/chat',
    conversationId: currentConversation,
    body: requestBody,
    onConversationCreated: async (newConvId) => {
      // Traccia il nuovo ID invece di aggiornare direttamente lo store
      // L'aggiornamento verrà fatto in un useEffect per evitare errori di rendering
      setNewConversationId(newConvId);
      pendingNewConversationRef.current = false;
      // Il Realtime aggiornerà automaticamente la sidebar via useChatStore
      // Non serve più fetchConversations qui
    },
    onFinish: async () => {
      // Il Realtime aggiornerà automaticamente le conversazioni via useChatStore
      // Non serve più fetchConversations qui

      if (screenContext?.type === 'oneagenda' && onContextUpdate) {
        setTimeout(() => onContextUpdate({}), 500);
      }
      
      // Process next queued message if any
      isProcessingQueueRef.current = false;
    },
    onError: (err) => {
      logger.error('Chat error:', err);
      pendingNewConversationRef.current = false;
    },
  });


  // Initialize ChatStore on mount se necessario
  useEffect(() => {
    if (userId && mode === 'fullscreen') {
      const chatStore = useChatStore.getState();
      if (!chatStore.userId || chatStore.userId !== userId) {
        chatStore.initialize(userId);
      }
    }
  }, [userId, mode]);

  // Aggiorna ChatStore quando viene ricevuto un nuovo conversationId dalla risposta
  // Questo deve essere fatto in un useEffect per evitare errori di rendering
  useEffect(() => {
    if (newConversationId) {
      // Usa getState() per evitare dipendenze instabili
      const store = useChatStore.getState();
      store.setCurrentConversation(newConversationId);
      // Reset solo dopo aver verificato che lo store è stato aggiornato
      // Questo evita race conditions
      if (store.currentConversationId === newConversationId) {
        setNewConversationId(null);
      }
    }
  }, [newConversationId]);

  // ============================================================================
  // Chat Completion → Fetch Updated Data → Update Store
  // When chat finishes streaming, fetch fresh data and update copilot-active-context.
  // This triggers sync hooks in visual builders for instant UI updates.
  // ============================================================================
  const updateWorkoutProgram = useCopilotActiveContextStore((s) => s.updateWorkoutProgram);
  const updateNutritionPlan = useCopilotActiveContextStore((s) => s.updateNutritionPlan);
  const previousStatusRef = useRef<typeof status | null>(null);
  
  useEffect(() => {
    // Detect when chat finishes: streaming → ready
    const wasStreaming = previousStatusRef.current === 'streaming';
    const isNowReady = status === 'ready';
    
    if (wasStreaming && isNowReady) {
      // Get current active context directly from store to avoid stale closures
      const ctx = useCopilotActiveContextStore.getState();
      
      // Fetch and update workout if active
      if (ctx.workout?.programId) {
        fetch(`/api/workouts/${ctx.workout.programId}`)
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            if (data?.program) {
              updateWorkoutProgram(data.program);
            }
          })
          .catch(() => { /* Silent fail - UI will stay unchanged */ });
      }
      
      // Fetch and update nutrition if active
      if (ctx.nutrition?.planId) {
        fetch(`/api/nutrition/${ctx.nutrition.planId}`)
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            if (data?.plan) {
              updateNutritionPlan(data.plan);
            }
          })
          .catch(() => { /* Silent fail */ });
      }
      
      // Note: OneAgenda would need similar treatment once store is extended
    }
    
    previousStatusRef.current = status;
  }, [status, updateWorkoutProgram, updateNutritionPlan]);

  // Actions
  const setInput = useCallback(
    (value: string) => {
      setCoreInput(value);
    },
    [setCoreInput]
  );

  const setSelectedModel = useCallback(
    (modelId: string) => {
      // Use Zustand store as SSOT for model selection
      storeSelectModel(modelId);
      // Also update provider if available for backward compatibility
      if (providerContext) {
        providerContext.setSelectedModel(modelId);
      }
    },
    [storeSelectModel, providerContext]
  );

  const setIsOpen = useCallback(
    (open: boolean) => {
      if (providerContext) {
        providerContext.setIsOpen(open);
      } else {
        setLocalIsOpen(open);
      }
    },
    [providerContext]
  );

  const toggleOpen = useCallback(() => {
    if (providerContext) {
      providerContext.toggleOpen();
    } else {
      setLocalIsOpen((prev) => !prev);
    }
  }, [providerContext]);

  // Message Queue CRUD operations (definite prima di sendMessage che le usa)
  const addToQueue = useCallback((text: string, files?: File[]): string => {
    const id = `queue-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newItem: QueuedMessage = {
      id,
      text,
      createdAt: new Date(),
      files,
    };
    setMessageQueue(prev => [...prev, newItem]);
    return id;
  }, []);

  const sendMessage = useCallback(
    async (options?: { text?: string }) => {
      const messageText = options?.text?.trim() || input.trim();
      if (!messageText) return;

      // Se già in loading, accoda il messaggio invece di bloccare
      if (isLoading) {
        addToQueue(messageText);
        setInput('');
        return;
      }

      // Mark that we're expecting a new conversation if we don't have one
      if (!currentConversation) {
        pendingNewConversationRef.current = true;
      }

      setInput('');

      try {
        await coreSendMessage({ text: messageText });
      } catch (err) {
        logger.error('Error sending message:', err);
        pendingNewConversationRef.current = false;
        setInput(messageText);
      }
    },
    [input, isLoading, coreSendMessage, setInput, currentConversation, addToQueue]
  );


  const loadConversation = useCallback(
    async (conversationId: string) => {
      try {
        // Usa ChatStore per caricare la conversazione
        const chatStoreLoadConversation = useChatStore.getState().loadConversation;
        await chatStoreLoadConversation(conversationId);
        
        // Carica i messaggi dalla conversazione
        const response = await fetch(`/api/copilot/conversations/${conversationId}`);
        if (response.ok) {
          const data = await response.json();
          // Ricostruisce UIMessage con parts complete (include tool-call/tool-result/reasoning)
          const loadedMessages: UIMessage[] = (data.messages || []).map(
            (msg: Record<string, unknown>) => {
              // Se il messaggio ha già parts salvate, usale direttamente
              if (msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0) {
                return {
                  id: msg.id as string,
                  role: (msg.role as string).toLowerCase() as 'user' | 'assistant' | 'system',
                  parts: msg.parts as UIMessage['parts'],
                };
              }
              // Fallback: crea parts da content testuale
              return {
                id: msg.id as string,
                role: (msg.role as string).toLowerCase() as 'user' | 'assistant' | 'system',
                parts: [{ type: 'text' as const, text: msg.content as string }],
              };
            }
          );
          setCoreMessages(loadedMessages);
          chatStoreSetCurrentConversation(conversationId);
        }
      } catch (err) {
        logger.error('Error loading conversation:', err);
      }
    },
    [setCoreMessages, chatStoreSetCurrentConversation]
  );

  const startNewConversation = useCallback(() => {
    // Stop any running generation to allow immediate messaging in new chat
    stop();
    isProcessingQueueRef.current = false;
    setMessageQueue([]);
    chatStoreSetCurrentConversation(null);
    resetCore();
    setInput('');
  }, [resetCore, setInput, stop, chatStoreSetCurrentConversation]);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await chatStoreDeleteConversation(id);
        if (currentConversation === id) {
          chatStoreSetCurrentConversation(null);
          resetCore();
        }
      } catch (err) {
        logger.error('Error deleting conversation:', err);
      }
    },
    [currentConversation, resetCore, chatStoreDeleteConversation, chatStoreSetCurrentConversation]
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        await chatStoreRenameConversation(id, title);
      } catch (err) {
        logger.error('Error renaming conversation:', err);
      }
    },
    [chatStoreRenameConversation]
  );

  const deleteConversations = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      try {
        await chatStoreDeleteConversations(ids);
        if (currentConversation && ids.includes(currentConversation)) {
          chatStoreSetCurrentConversation(null);
          resetCore();
        }
      } catch (err) {
        logger.error('Error deleting conversations:', err);
      }
    },
    [currentConversation, resetCore, chatStoreDeleteConversations, chatStoreSetCurrentConversation]
  );

  const deleteAllConversations = useCallback(async () => {
    try {
      await chatStoreDeleteAllConversations();
      chatStoreSetCurrentConversation(null);
      resetCore();
    } catch (err) {
      logger.error('Error deleting all conversations:', err);
    }
  }, [resetCore, chatStoreDeleteAllConversations, chatStoreSetCurrentConversation]);

  const reload = useCallback(async () => {
    await coreReload();
  }, [coreReload]);

  // Message Queue CRUD operations (addToQueue già definita sopra prima di sendMessage)

  const updateQueuedMessage = useCallback((id: string, text: string) => {
    setMessageQueue(prev => prev.map(item => 
      item.id === id ? { ...item, text } : item
    ));
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setMessageQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setMessageQueue([]);
  }, []);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setMessageQueue(prev => {
      const result = [...prev];
      const removed = result.splice(fromIndex, 1)[0];
      if (removed) {
        result.splice(toIndex, 0, removed);
      }
      return result;
    });
  }, []);

  // Process queue: send next message when not loading
  useEffect(() => {
    const processNextInQueue = async () => {
      if (isLoading || messageQueue.length === 0 || isProcessingQueueRef.current) {
        return;
      }
      
      const nextMessage = messageQueue[0];
      if (!nextMessage) return;
      
      isProcessingQueueRef.current = true;
      
      // Remove from queue
      setMessageQueue(prev => prev.slice(1));
      
      // Send the message
      try {
        if (!currentConversation) {
          pendingNewConversationRef.current = true;
        }
        await coreSendMessage({ text: nextMessage.text });
      } catch (err) {
        logger.error('Error sending queued message:', err);
        isProcessingQueueRef.current = false;
      }
    };
    
    processNextInQueue();
  }, [isLoading, messageQueue, coreSendMessage, currentConversation]);

  return {
    // Chat state
    messages,
    input,
    status,
    isLoading,
    error,

    // Conversation state
    conversations,
    currentConversation,
    isDeleting: chatStoreIsDeleting,

    // Context state
    screenContext,
    features,
    models,
    selectedModel,
    userRole,
    userCredits,

    // UI state
    isOpen,

    // Message Queue state
    messageQueue,

    // Actions
    sendMessage,
    setInput,
    setSelectedModel,
    loadConversation,
    startNewConversation,
    deleteConversation,
    renameConversation,
    deleteConversations,
    deleteAllConversations,
    reload,
    stop,
    setIsOpen,
    toggleOpen,

    // Message Queue actions (CRUD)
    addToQueue,
    updateQueuedMessage,
    removeFromQueue,
    clearQueue,
    reorderQueue,
  };
}
