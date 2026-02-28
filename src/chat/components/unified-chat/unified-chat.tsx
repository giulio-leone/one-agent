/**
 * UnifiedChat Component
 *
 * Componente UI unificato per Chat e Copilot con:
 * - 3 modalità: fullscreen, sidebar, floating
 * - Responsive: bottom sheet su mobile, sidebar su desktop
 * - Sidebar ridimensionabile (desktop/tablet)
 * - Tutte le feature AI Elements
 * - Design glassmorphism SOTA
 * - Persistenza conversazioni
 * - Screen context automatico
 *
 * PRINCIPI: KISS, SOLID, DRY
 */

'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  BotIcon,
  CopyIcon,
  CheckIcon,
  SettingsIcon,
  Coins,
  Shield,
  Camera,
  Scan,
  MessageSquare,
  Brain,
  Lightbulb,
  Paperclip,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useUnifiedChat } from '../../hooks/use-unified-chat';
import type { UnifiedChatProps, ScreenContextType } from '../../types/unified-chat';
import { cn } from './utils';

// ============================================================================
// Context Type Styles
// ============================================================================

const CONTEXT_STYLES: Record<ScreenContextType, { gradient: string; label: string }> = {
  nutrition: { gradient: 'from-emerald-500 to-teal-600', label: 'Nutrizione' },
  workout: { gradient: 'from-orange-500 to-red-600', label: 'Allenamento' },
  chat: { gradient: 'from-primary-500 to-violet-600', label: 'Chat' },
  analytics: { gradient: 'from-blue-500 to-cyan-600', label: 'Analytics' },
  oneagenda: { gradient: 'from-purple-500 to-pink-600', label: 'OneAgenda' },
  exercise: { gradient: 'from-amber-500 to-orange-600', label: 'Esercizi' },
  general: { gradient: 'from-primary-500 to-violet-600', label: 'Assistente' },
};

// Default suggestions
const DEFAULT_SUGGESTIONS = [
  'Come posso migliorare la mia alimentazione?',
  'Suggeriscimi un allenamento per oggi',
  'Quali sono i migliori esercizi per...',
  'Analizza il mio progresso',
];

// ============================================================================
// UnifiedChat Component
// ============================================================================

export function UnifiedChat({
  mode,
  contextType: contextTypeProp,
  contextData,
  initialConversations = [],
  onContextUpdate,
  isOpen: controlledIsOpen,
  onToggle,
  onClose,
  className,
  width = 420,
  isResizing = false,
  resizeHandle,
}: UnifiedChatProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<'label' | 'dish' | null>(null);

  // AI Features local toggles (override feature flags)
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(true);

  // Detect screen size for responsive behavior
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Build context override from props - include entityId for proper context
  const contextOverride = contextTypeProp
    ? {
        type: contextTypeProp,
        entityId:
          (contextData as { entityId?: string; id?: string })?.entityId ||
          (contextData as { id?: string })?.id,
        entityType: (
          contextData as { entityType?: 'workout' | 'nutrition_plan' | 'exercise' | 'analytics' }
        )?.entityType,
        data: contextData,
      }
    : undefined;

  // Use unified chat hook with reasoning toggle
  const chat = useUnifiedChat({
    mode,
    contextOverride,
    initialConversations,
    onContextUpdate,
    reasoningEnabled, // Pass toggle state to hook
  });

  const {
    messages,
    input,
    status,
    isLoading,
    screenContext,
    features,
    models,
    selectedModel,
    userRole,
    userCredits,
    isOpen: hookIsOpen,
    sendMessage,
    setInput,
    setSelectedModel,
    setIsOpen,
  } = chat;

  // Controlled or uncontrolled open state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : hookIsOpen;
  const handleSetOpen = (open: boolean) => {
    if (onToggle) {
      onToggle(open);
    } else {
      setIsOpen(open);
    }
  };

  // Get context type and styles
  const contextType = screenContext?.type || contextTypeProp || 'general';
  const contextStyle = CONTEXT_STYLES[contextType];

  // Check if user can access model selector
  const canAccessModelSelector =
    features.modelSelector && (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN');

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if ((mode === 'sidebar' || mode === 'floating') && isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, mode]);

  // Copy handler
  const handleCopy = useCallback((messageId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  }, []);

  // Submit handler
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isLoading) return;
      sendMessage({ text: input });
    },
    [input, isLoading, sendMessage]
  );

  // Suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      sendMessage({ text: suggestion });
    },
    [sendMessage]
  );

  // Close handler
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      handleSetOpen(false);
    }
    setCameraMode(null);
  };

  // Get suggested prompts
  const suggestedPrompts = screenContext?.suggestedPrompts || DEFAULT_SUGGESTIONS;

  // ============================================================================
  // Render Message Part
  // ============================================================================

  const renderMessagePart = (
    part: { type: string; text?: string; [key: string]: unknown },
    index: number,
    _isLastPart: boolean,
    messageId: string
  ) => {
    if (part.type === 'text') {
      const text = part.text || '';
      const isCopied = copiedMessageId === `${messageId}-${index}`;

      return (
        <div key={index} className="group relative">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
          {/* Message actions */}
          <div className="absolute right-0 -bottom-6 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => handleCopy(`${messageId}-${index}`, text)}
              className="rounded-md bg-neutral-100 p-1 text-neutral-500 hover:text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              title={isCopied ? 'Copiato!' : 'Copia'}
            >
              {isCopied ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
            </button>
          </div>
        </div>
      );
    }

    if (part.type === 'reasoning' && reasoningEnabled) {
      return (
        <details
          key={index}
          open
          className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-900/30"
        >
          <summary className="cursor-pointer text-sm font-medium text-violet-700 dark:text-violet-300">
            <Brain className="mr-1.5 inline-block h-4 w-4" />
            Ragionamento AI
          </summary>
          <div className="mt-2 text-sm text-violet-600 dark:text-violet-200">{part.text}</div>
        </details>
      );
    }

    if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
      const toolName = (part.toolName as string) || 'Tool';
      const toolResult = part.result as unknown;
      const isComplete = toolResult !== undefined;

      return (
        <div
          key={index}
          className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            <span className="animate-pulse">⚙️</span>
            {toolName}
            {isComplete && <span className="text-green-500">✓</span>}
          </div>
        </div>
      );
    }

    return null;
  };

  // ============================================================================
  // Render Messages
  // ============================================================================

  const renderMessages = () => {
    if (messages.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center space-y-6 p-4">
          <div className="relative">
            <div
              className={cn(
                'absolute inset-0 animate-pulse rounded-full blur-xl',
                `bg-gradient-to-br ${contextStyle.gradient}`,
                'opacity-30'
              )}
            />
            <div
              className={cn(
                'relative flex h-16 w-16 items-center justify-center rounded-full',
                `bg-gradient-to-br ${contextStyle.gradient}`,
                'shadow-lg'
              )}
            >
              <BotIcon className="h-8 w-8 text-white" />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Copilot Chat</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Fai una domanda o chiedi modifiche
            </p>
          </div>

          {/* Suggestions */}
          {features.suggestions && suggestionsEnabled && (
            <div className="w-full max-w-md">
              <p className="mb-2 text-center text-xs text-neutral-400 dark:text-neutral-500">
                Inizia con una domanda
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedPrompts.slice(0, 4).map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs transition-all',
                      'bg-white dark:bg-neutral-800',
                      'border border-neutral-200 dark:border-neutral-700',
                      'text-neutral-700 dark:text-neutral-300',
                      'hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700',
                      'dark:hover:bg-primary-900/30 dark:hover:border-primary-700 dark:hover:text-primary-300'
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4 p-4">
        {messages.map((message, msgIndex) => {
          const isUser = message.role === 'user';
          const isLastMessage = msgIndex === messages.length - 1;

          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-3',
                  isUser
                    ? cn(`bg-gradient-to-br ${contextStyle.gradient}`, 'text-white shadow-lg')
                    : cn(
                        'bg-white dark:bg-neutral-800',
                        'border border-neutral-200 dark:border-neutral-700',
                        'text-neutral-900 dark:text-white'
                      )
                )}
              >
                {message.parts?.map((part: { type: string; text?: string }, idx: number) => {
                  const isLastPart = isLastMessage && idx === (message.parts?.length ?? 0) - 1;
                  return renderMessagePart(part, idx, isLastPart, message.id);
                })}
              </div>
            </motion.div>
          );
        })}

        {/* Loading indicator */}
        {status === 'submitted' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div
              className={cn(
                'rounded-2xl px-4 py-3',
                'bg-white dark:bg-neutral-800',
                'border border-neutral-200 dark:border-neutral-700'
              )}
            >
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 dark:bg-neutral-500" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:0.1s] dark:bg-neutral-500" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:0.2s] dark:bg-neutral-500" />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>
    );
  };

  // ============================================================================
  // Render Input
  // ============================================================================

  const renderInput = () => (
    <div className="border-t border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      {/* Camera buttons for nutrition context */}
      {(contextType === 'nutrition' || contextType === 'chat') && !cameraMode && (
        <div className="mb-2 flex gap-2">
          <button
            onClick={() => setCameraMode('label')}
            disabled={isLoading}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2',
              'text-sm font-medium transition-all',
              'bg-neutral-100 dark:bg-neutral-800',
              'border border-neutral-200 dark:border-neutral-700',
              'text-neutral-700 dark:text-neutral-300',
              'hover:bg-neutral-200 dark:hover:bg-neutral-700',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <Scan className="h-4 w-4" />
            Etichetta
          </button>
          <button
            onClick={() => setCameraMode('dish')}
            disabled={isLoading}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2',
              'text-sm font-medium transition-all',
              'bg-neutral-100 dark:bg-neutral-800',
              'border border-neutral-200 dark:border-neutral-700',
              'text-neutral-700 dark:text-neutral-300',
              'hover:bg-neutral-200 dark:hover:bg-neutral-700',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <Camera className="h-4 w-4" />
            Piatto
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div
          className={cn(
            'flex flex-1 overflow-hidden rounded-xl',
            'bg-neutral-100 dark:bg-neutral-800',
            'border border-neutral-200 dark:border-neutral-700',
            'focus-within:border-primary-500 focus-within:ring-primary-500/20 focus-within:ring-2',
            'transition-all'
          )}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Scrivi un messaggio..."
            rows={1}
            disabled={isLoading}
            className={cn(
              'flex-1 resize-none bg-transparent px-3 py-2.5',
              'text-sm text-neutral-900 dark:text-white',
              'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
              'focus:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            `bg-gradient-to-br ${contextStyle.gradient}`,
            'text-white shadow-lg',
            'hover:scale-105 hover:shadow-xl',
            'disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
            'transition-all'
          )}
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )}
        </button>
      </form>

      <p className="mt-2 text-center text-xs text-neutral-400 dark:text-neutral-500">
        <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-neutral-800">
          Enter
        </kbd>{' '}
        per inviare •{' '}
        <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-neutral-800">
          Shift+Enter
        </kbd>{' '}
        nuova riga
      </p>
    </div>
  );

  // ============================================================================
  // Render Header
  // ============================================================================

  const renderHeader = () => (
    <div
      className={cn(
        'relative shrink-0 border-b',
        'border-neutral-200 dark:border-neutral-800',
        'bg-white dark:bg-neutral-900'
      )}
    >
      {/* Decorative gradient line */}
      <div
        className={cn('absolute inset-x-0 top-0 h-1', `bg-gradient-to-r ${contextStyle.gradient}`)}
      />

      <div className="flex items-center justify-between px-4 py-3 pt-4">
        <div className="flex items-center gap-3">
          {/* Context icon and title */}
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl',
              `bg-gradient-to-br ${contextStyle.gradient}`,
              'shadow-lg'
            )}
          >
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {mode === 'fullscreen' ? 'AI Coach' : 'Copilot Chat'}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{contextStyle.label}</p>
          </div>

          {/* Credits badge */}
          <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 dark:bg-amber-500/20">
            <Coins className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
              {userCredits.toLocaleString('it-IT')}
            </span>
          </div>

          {/* Role badge (admin only) */}
          {(userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') && (
            <div className="hidden items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-1 sm:flex dark:bg-violet-500/20">
              <Shield className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                {userRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* AI Feature Toggles */}
          <div className="flex items-center gap-1">
            {/* Reasoning Toggle */}
            {features.reasoning !== undefined && (
              <button
                onClick={() => setReasoningEnabled(!reasoningEnabled)}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all',
                  reasoningEnabled
                    ? 'bg-violet-500/20 text-violet-700 dark:text-violet-300'
                    : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
                  'hover:bg-violet-500/30'
                )}
                title={reasoningEnabled ? 'Reasoning attivo' : 'Attiva Reasoning'}
              >
                <Brain className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reasoning</span>
              </button>
            )}

            {/* Suggestions Toggle */}
            <button
              onClick={() => setSuggestionsEnabled(!suggestionsEnabled)}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all',
                suggestionsEnabled
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
                'hover:bg-amber-500/30'
              )}
              title={suggestionsEnabled ? 'Suggerimenti attivi' : 'Attiva suggerimenti'}
            >
              <Lightbulb className="h-3.5 w-3.5" />
            </button>

            {/* Attachments indicator */}
            {features.attachments && (
              <div
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium',
                  'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                )}
                title="Allegati supportati"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </div>
            )}
          </div>

          {/* Model selector (admin only) */}
          {canAccessModelSelector && models.length > 0 && (
            <div className="hidden items-center gap-2 sm:flex">
              <SettingsIcon className="h-4 w-4 text-neutral-400" />
              <select
                value={selectedModel || ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSelectedModel(e.target.value)
                }
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              >
                {models.map((model: any) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Close button - only for sidebar/floating mode */}
          {mode !== 'fullscreen' && (
            <button
              onClick={handleClose}
              className={cn(
                'rounded-xl p-2 transition-all',
                'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white',
                'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
              aria-label="Chiudi"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // Fullscreen Mode
  // ============================================================================

  if (mode === 'fullscreen') {
    return (
      <div
        className={cn(
          'relative flex h-full w-full flex-col overflow-hidden bg-white dark:bg-neutral-900',
          className
        )}
      >
        {renderHeader()}
        <div className="relative flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950">
          {renderMessages()}
        </div>
        {renderInput()}
      </div>
    );
  }

  // ============================================================================
  // Sidebar Mode - Responsive: Bottom Sheet su Mobile, Sidebar su Desktop
  // ============================================================================

  if (mode === 'sidebar') {
    // Mobile: Bottom Sheet
    if (isMobile) {
      return (
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50"
                onClick={() => handleSetOpen(false)}
              />

              {/* Bottom Sheet */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className={cn(
                  'fixed right-0 bottom-0 left-0 z-50 max-h-[85vh]',
                  'rounded-t-3xl',
                  'bg-white dark:bg-neutral-900',
                  'border-t border-neutral-200 dark:border-neutral-800',
                  'shadow-2xl',
                  className
                )}
              >
                {/* Drag handle */}
                <div
                  className="flex cursor-grab touch-none items-center justify-center py-3 active:cursor-grabbing"
                  onClick={() => handleSetOpen(!isOpen)}
                >
                  <div className="h-1.5 w-12 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                </div>

                <div className="flex max-h-[calc(85vh-3rem)] flex-col overflow-hidden">
                  {renderHeader()}
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-neutral-50 dark:bg-neutral-950">
                    {renderMessages()}
                  </div>
                  {renderInput()}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      );
    }

    // Desktop/Tablet: Resizable Sidebar
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 300,
              ...(isResizing && { duration: 0 }),
            }}
            style={{ width: `${width}px` }}
            className={cn(
              'fixed top-0 right-0 z-50 h-full',
              'bg-white dark:bg-neutral-900',
              'border-l border-neutral-200 dark:border-neutral-800',
              'shadow-2xl',
              isResizing && 'select-none',
              className
            )}
          >
            {/* Resize Handle Slot */}
            {resizeHandle}

            <div className="flex h-full flex-col">
              {renderHeader()}
              <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950">
                {renderMessages()}
              </div>
              {renderInput()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ============================================================================
  // Floating Mode (Mobile bottom sheet)
  // ============================================================================

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            onClick={() => handleSetOpen(false)}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'fixed right-0 bottom-0 left-0 z-50 max-h-[85vh] lg:hidden',
              'rounded-t-3xl',
              'bg-white dark:bg-neutral-900',
              'border-t border-neutral-200 dark:border-neutral-800',
              'shadow-2xl',
              className
            )}
          >
            {/* Drag handle */}
            <div
              className="flex cursor-grab touch-none items-center justify-center py-3 active:cursor-grabbing"
              onClick={() => handleSetOpen(!isOpen)}
            >
              <div className="h-1.5 w-12 rounded-full bg-neutral-300 dark:bg-neutral-600" />
            </div>

            <div className="flex max-h-[calc(85vh-3rem)] flex-col overflow-hidden">
              {renderHeader()}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-neutral-50 dark:bg-neutral-950">
                {renderMessages()}
              </div>
              {renderInput()}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
