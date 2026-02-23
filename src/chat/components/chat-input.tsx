/**
 * ChatInput Component
 *
 * Componente input per la chat.
 * Auto-resize textarea, send/stop button, accessibilità.
 *
 * FEATURES:
 * - Auto-resize textarea
 * - Keyboard shortcuts (Ctrl+Enter, Shift+Enter)
 * - Send e Stop buttons
 * - Slot per azioni custom (file upload, voice)
 * - Accessibilità completa
 */

'use client';

import React, { useRef, useCallback, memo, useEffect, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Square, Loader2 } from 'lucide-react';
import type { ChatInputProps, ChatVariant } from '../types';

// ============================================================================
// Styles
// ============================================================================

const variantStyles: Record<
  ChatVariant,
  {
    container: string;
    textarea: string;
    button: string;
  }
> = {
  default: {
    container: 'p-4 border-t bg-background',
    textarea: 'min-h-[52px] max-h-[200px] text-base',
    button: 'w-10 h-10',
  },
  compact: {
    container: 'p-2 border-t bg-background',
    textarea: 'min-h-[40px] max-h-[120px] text-sm',
    button: 'w-8 h-8',
  },
  embedded: {
    container: 'p-3 border-t bg-muted/30',
    textarea: 'min-h-[44px] max-h-[150px] text-sm',
    button: 'w-9 h-9',
  },
  floating: {
    container: 'p-2 border-t bg-background/95 backdrop-blur',
    textarea: 'min-h-[36px] max-h-[100px] text-sm',
    button: 'w-8 h-8',
  },
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * ChatInput - Componente input per la chat.
 *
 * @example
 * ```tsx
 * <ChatInput
 *   value={input}
 *   onChange={setInput}
 *   onSend={handleSend}
 *   onStop={handleStop}
 *   isLoading={isLoading}
 *   placeholder="Scrivi un messaggio..."
 * />
 * ```
 */
export const ChatInput = memo(function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isLoading = false,
  placeholder = 'Scrivi un messaggio...',
  variant = 'default',
  disabled = false,
  maxLength,
  autoFocus = false,
  actions,
  className = '',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const styles = variantStyles[variant];

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, []);

  // Adjust height on value change
  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Auto focus
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (maxLength && newValue.length > maxLength) return;
      onChange(newValue);
    },
    [onChange, maxLength]
  );

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter without modifiers = send
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (!isLoading && value.trim()) {
          onSend();
        }
      }
      // Ctrl+Enter or Cmd+Enter = new line (already default with Shift)
    },
    [isLoading, value, onSend]
  );

  // Handle send click
  const handleSendClick = useCallback(() => {
    if (!isLoading && value.trim()) {
      onSend();
    }
  }, [isLoading, value, onSend]);

  // Handle stop click
  const handleStopClick = useCallback(() => {
    if (isLoading && onStop) {
      onStop();
    }
  }, [isLoading, onStop]);

  const canSend = !disabled && !isLoading && value.trim().length > 0;
  const showStopButton = isLoading && onStop;

  return (
    <div className={`${styles.container} ${className}`}>
      <div className="flex items-end gap-2">
        {/* Actions slot (file upload, voice, etc.) */}
        {actions && <div className="flex items-center gap-1 pb-1">{actions}</div>}

        {/* Textarea container */}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={1}
            className={`border-input bg-background focus:ring-ring placeholder:text-muted-foreground w-full resize-none rounded-xl border px-4 py-3 pr-12 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${styles.textarea} `}
            style={{
              overflowY: 'auto',
            }}
            aria-label="Message input"
            aria-describedby={maxLength ? 'char-count' : undefined}
          />

          {/* Character count */}
          {maxLength && (
            <span
              id="char-count"
              className={`absolute right-14 bottom-3 text-xs ${
                value.length > maxLength * 0.9 ? 'text-destructive' : 'text-muted-foreground'
              } `}
            >
              {value.length}/{maxLength}
            </span>
          )}
        </div>

        {/* Send/Stop button */}
        <AnimatePresence mode="wait">
          {showStopButton ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={handleStopClick}
              className={` ${styles.button} bg-destructive text-destructive-foreground hover:bg-destructive/90 flex flex-shrink-0 items-center justify-center rounded-xl transition-colors`}
              aria-label="Stop generating"
              title="Stop generating"
            >
              <Square className="h-4 w-4" fill="currentColor" />
            </motion.button>
          ) : (
            <motion.button
              key="send"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={handleSendClick}
              disabled={!canSend}
              className={` ${styles.button} flex flex-shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
                canSend
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              } `}
              aria-label="Send message"
              title="Send message (Enter)"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard hint */}
      <p className="text-muted-foreground mt-1.5 text-center text-[10px]">
        <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[9px]">Enter</kbd> per inviare
        {' · '}
        <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[9px]">Shift+Enter</kbd> per
        nuova riga
      </p>
    </div>
  );
});

export default ChatInput;
