/**
 * MessageBubble Component
 *
 * Componente per visualizzare un singolo messaggio chat.
 * Supporta markdown, syntax highlighting, animazioni e accessibilità.
 *
 * PRINCIPI:
 * - KISS: API semplice con customizzazione tramite props
 * - SOLID: Single Responsibility - solo rendering messaggio
 * - DRY: Riutilizzabile per Chat e Copilot
 *
 * FEATURES:
 * - Markdown rendering con react-markdown
 * - Syntax highlighting con react-syntax-highlighter
 * - Animazioni fluide con framer-motion
 * - Accessibilità (ARIA, keyboard navigation)
 * - Copy to clipboard
 * - Indicatore streaming
 */

'use client';

import React, { useState, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, User, Bot, RefreshCw, Pencil } from 'lucide-react';
import remarkGfm from 'remark-gfm';
import type { MessageBubbleProps, ChatVariant } from '../types';

// ============================================================================
// Styles
// ============================================================================

const variantStyles: Record<
  ChatVariant,
  {
    container: string;
    userBubble: string;
    assistantBubble: string;
    avatar: string;
  }
> = {
  default: {
    container: 'py-4 px-4',
    userBubble:
      'bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3 max-w-[85%]',
    assistantBubble: 'bg-muted rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]',
    avatar: 'w-8 h-8',
  },
  compact: {
    container: 'py-2 px-3',
    userBubble: 'bg-primary/10 text-foreground rounded-xl px-3 py-2 max-w-[90%]',
    assistantBubble: 'bg-muted/50 rounded-xl px-3 py-2 max-w-[90%]',
    avatar: 'w-6 h-6',
  },
  embedded: {
    container: 'py-3 px-3',
    userBubble: 'bg-primary text-primary-foreground rounded-xl px-3 py-2 max-w-[80%]',
    assistantBubble: 'bg-secondary rounded-xl px-3 py-2 max-w-[80%]',
    avatar: 'w-7 h-7',
  },
  floating: {
    container: 'py-2 px-2',
    userBubble: 'bg-primary text-primary-foreground rounded-lg px-3 py-2 max-w-[85%] text-sm',
    assistantBubble: 'bg-muted rounded-lg px-3 py-2 max-w-[85%] text-sm',
    avatar: 'w-6 h-6',
  },
};

// ============================================================================
// Animation Variants
// ============================================================================

const messageVariants = {
  hidden: {
    opacity: 0,
    y: 10,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut' as const,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.15,
    },
  },
};

// ============================================================================
// Sub-components
// ============================================================================

interface CodeBlockProps {
  language: string;
  value: string;
  variant: ChatVariant;
}

const CodeBlock = memo(function CodeBlock({ language, value, variant }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  const fontSize = variant === 'compact' || variant === 'floating' ? '12px' : '13px';

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg">
      {/* Header con linguaggio e copy */}
      <div className="flex items-center justify-between bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
        <span className="font-mono">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 transition-colors hover:text-zinc-200"
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code block */}
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize,
          borderRadius: 0,
        }}
        wrapLongLines
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
});

interface StreamingIndicatorProps {
  variant: ChatVariant;
}

const StreamingIndicator = memo(function StreamingIndicator({ variant }: StreamingIndicatorProps) {
  const dotSize = variant === 'compact' || variant === 'floating' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span className="ml-1 inline-flex items-center gap-1" aria-label="Generating response">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={`${dotSize} rounded-full bg-current opacity-60`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </span>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * MessageBubble - Componente per visualizzare un messaggio chat.
 *
 * @example
 * ```tsx
 * <MessageBubble
 *   message={{ id: '1', role: 'user', content: 'Hello!' }}
 *   variant="default"
 * />
 *
 * <MessageBubble
 *   message={{ id: '2', role: 'assistant', content: '**Hello!** How can I help?' }}
 *   isStreaming={true}
 *   onCopy={() => copyToClipboard(message.content)}
 * />
 * ```
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  variant = 'default',
  isStreaming = false,
  avatar,
  onCopy,
  onEdit,
  onRegenerate,
  renderContent,
  className = '',
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  const isUser = message.role === 'user';
  const styles = variantStyles[variant];

  // Handle copy
  const handleCopy = useCallback(async () => {
    if (onCopy) {
      onCopy();
    } else {
      await navigator.clipboard.writeText(message.content);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content, onCopy]);

  // Markdown components per react-markdown
  const markdownComponents = useMemo(
    () => ({
      code({
        node,
        inline,
        className: codeClassName,
        children,
        ...props
      }: {
        node?: unknown;
        inline?: boolean;
        className?: string;
        children?: React.ReactNode;
      }) {
        const match = /language-(\w+)/.exec(codeClassName || '');
        const language = match ? match[1] : '';
        const codeString = String(children).replace(/\n$/, '');

        if (!inline && (match || codeString.includes('\n'))) {
          return <CodeBlock language={language || 'text'} value={codeString} variant={variant} />;
        }

        return (
          <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm" {...props}>
            {children}
          </code>
        );
      },
      p({ children }: { children?: React.ReactNode }) {
        return <p className="mb-2 leading-relaxed last:mb-0">{children}</p>;
      },
      ul({ children }: { children?: React.ReactNode }) {
        return <ul className="mb-2 list-inside list-disc space-y-1">{children}</ul>;
      },
      ol({ children }: { children?: React.ReactNode }) {
        return <ol className="mb-2 list-inside list-decimal space-y-1">{children}</ol>;
      },
      a({ href, children }: { href?: string; children?: React.ReactNode }) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            {children}
          </a>
        );
      },
      blockquote({ children }: { children?: React.ReactNode }) {
        return (
          <blockquote className="border-primary/50 my-2 border-l-2 pl-3 italic opacity-90">
            {children}
          </blockquote>
        );
      },
      strong({ children }: { children?: React.ReactNode }) {
        return <strong className="font-semibold">{children}</strong>;
      },
    }),
    [variant]
  );

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={` ${styles.container} flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} ${className} `}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      role="article"
      aria-label={`${isUser ? 'Your' : 'Assistant'} message`}
    >
      {/* Avatar */}
      <div
        className={` ${styles.avatar} flex flex-shrink-0 items-center justify-center rounded-full ${isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'} `}
        aria-hidden="true"
      >
        {avatar?.[isUser ? 'user' : 'assistant'] ? (
          <img
            src={avatar[isUser ? 'user' : 'assistant']}
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
        ) : isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Message Bubble */}
      <div className="flex min-w-0 flex-col gap-1">
        <div className={isUser ? styles.userBubble : styles.assistantBubble}>
          {/* Content */}
          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            {renderContent ? (
              renderContent(message.content)
            ) : (
              <ReactMarkdown
                components={markdownComponents as Record<string, React.ComponentType>}
                remarkPlugins={[remarkGfm]}
              >
                {message.content}
              </ReactMarkdown>
            )}

            {/* Streaming indicator */}
            {isStreaming && !isUser && <StreamingIndicator variant={variant} />}
          </div>
        </div>

        {/* Actions (visible on hover for assistant messages) */}
        <AnimatePresence>
          {showActions && !isUser && !isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center gap-1 px-1"
            >
              <button
                onClick={handleCopy}
                className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors"
                aria-label={copied ? 'Copied' : 'Copy message'}
                title="Copy"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>

              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors"
                  aria-label="Regenerate response"
                  title="Regenerate"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}

              {onEdit && (
                <button
                  onClick={onEdit}
                  className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors"
                  aria-label="Edit message"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

export default MessageBubble;

// ============================================================================
// LoadingBubble Component
// ============================================================================

interface LoadingBubbleProps {
  variant?: ChatVariant;
  className?: string;
}

/**
 * LoadingBubble - Indicatore di caricamento risposta AI.
 *
 * @example
 * ```tsx
 * {isLoading && <LoadingBubble variant="compact" />}
 * ```
 */
export const LoadingBubble = memo(function LoadingBubble({
  variant = 'default',
  className = '',
}: LoadingBubbleProps) {
  const styles = variantStyles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${styles.container} flex gap-3 ${className}`}
    >
      <div
        className={` ${styles.avatar} bg-secondary text-secondary-foreground flex flex-shrink-0 items-center justify-center rounded-full`}
        aria-hidden="true"
      >
        <Bot className="h-4 w-4" />
      </div>

      <div className={`${styles.assistantBubble} flex items-center gap-1.5`}>
        <span className="sr-only">Loading response</span>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="bg-primary/60 h-2 w-2 rounded-full"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
});
