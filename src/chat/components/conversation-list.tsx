/**
 * ConversationList Component
 *
 * Lista delle conversazioni con selezione, eliminazione e creazione.
 *
 * FEATURES:
 * - Lista scrollabile con virtualizzazione ready
 * - Selezione con highlight
 * - Delete con conferma
 * - Nuovo conversation button
 * - Timestamps relativi
 * - Accessibilità completa
 */

'use client';

import React, { memo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, Trash2, MoreVertical, Loader2 } from 'lucide-react';
import type { ConversationListProps, ChatConversation, ChatVariant } from '../types';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Formatta una data in formato relativo.
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Adesso';
  if (minutes < 60) return `${minutes}m fa`;
  if (hours < 24) return `${hours}h fa`;
  if (days < 7) return `${days}g fa`;

  return date.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
  });
}

// ============================================================================
// Styles
// ============================================================================

const variantStyles: Record<
  ChatVariant,
  {
    container: string;
    item: string;
    itemActive: string;
    header: string;
  }
> = {
  default: {
    container: 'h-full flex flex-col',
    item: 'px-4 py-3',
    itemActive: 'bg-accent',
    header: 'p-4 border-b',
  },
  compact: {
    container: 'h-full flex flex-col',
    item: 'px-3 py-2',
    itemActive: 'bg-accent/80',
    header: 'p-3 border-b',
  },
  embedded: {
    container: 'h-full flex flex-col',
    item: 'px-3 py-2.5',
    itemActive: 'bg-accent',
    header: 'p-3 border-b',
  },
  floating: {
    container: 'h-full flex flex-col',
    item: 'px-2 py-2',
    itemActive: 'bg-accent/70',
    header: 'p-2 border-b',
  },
};

// ============================================================================
// Sub-components
// ============================================================================

interface ConversationItemProps {
  conversation: ChatConversation;
  isActive: boolean;
  variant: ChatVariant;
  onSelect: () => void;
  onDelete?: () => void;
}

const ConversationItem = memo(function ConversationItem({
  conversation,
  isActive,
  variant,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const styles = variantStyles[variant];

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirmDelete) {
        onDelete?.();
        setConfirmDelete(false);
      } else {
        setConfirmDelete(true);
        // Reset after 3 seconds
        setTimeout(() => setConfirmDelete(false), 3000);
      }
    },
    [confirmDelete, onDelete]
  );

  const handleMenuToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowMenu(!showMenu);
    },
    [showMenu]
  );

  return (
    <motion.button
      layout
      onClick={onSelect}
      onMouseLeave={() => {
        setShowMenu(false);
        setConfirmDelete(false);
      }}
      className={`w-full text-left ${styles.item} ${isActive ? styles.itemActive : 'hover:bg-muted/50'} group relative flex items-start gap-3 rounded-lg transition-colors`}
      aria-current={isActive ? 'page' : undefined}
    >
      {/* Icon */}
      <div
        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'} `}
      >
        <MessageSquare className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium">{conversation.title}</h3>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {conversation.preview || 'Nessun messaggio'}
        </p>
      </div>

      {/* Time & Actions */}
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <span className="text-muted-foreground text-[10px]">
          {formatRelativeTime(conversation.updatedAt)}
        </span>

        {/* Menu button (visible on hover) */}
        <div
          className={` ${showMenu || confirmDelete ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
        >
          {confirmDelete ? (
            <button
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded px-2 py-1 text-xs"
            >
              Conferma
            </button>
          ) : onDelete ? (
            <button
              onClick={handleMenuToggle}
              className="hover:bg-muted rounded p-1 transition-colors"
              aria-label="Menu conversazione"
            >
              <MoreVertical className="text-muted-foreground h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown menu */}
      <AnimatePresence>
        {showMenu && onDelete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            className="bg-popover absolute top-full right-2 z-10 mt-1 min-w-[120px] rounded-lg border py-1 shadow-lg"
            onClick={(e: React.MouseEvent<HTMLElement>) => e.stopPropagation()}
          >
            <button
              onClick={handleDelete}
              className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Elimina
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * ConversationList - Lista delle conversazioni.
 *
 * @example
 * ```tsx
 * <ConversationList
 *   conversations={conversations}
 *   activeId={currentConversationId}
 *   onSelect={handleSelectConversation}
 *   onDelete={handleDeleteConversation}
 *   onNew={handleNewConversation}
 * />
 * ```
 */
export const ConversationList = memo(function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNew,
  isLoading = false,
  variant = 'default',
  className = '',
}: ConversationListProps) {
  const styles = variantStyles[variant];

  return (
    <div className={`${styles.container} ${className}`}>
      {/* Header */}
      <div className={`${styles.header} flex items-center justify-between`}>
        <h2 className="text-sm font-semibold">Conversazioni</h2>
        {onNew && (
          <button
            onClick={onNew}
            className="hover:bg-muted rounded-lg p-1.5 transition-colors"
            aria-label="Nuova conversazione"
            title="Nuova conversazione"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>Nessuna conversazione</p>
            {onNew && (
              <button onClick={onNew} className="text-primary mt-2 text-xs hover:underline">
                Inizia una nuova chat
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {conversations.map((conversation: any) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeId}
                variant={variant}
                onSelect={() => onSelect(conversation.id)}
                onDelete={onDelete ? () => onDelete(conversation.id) : undefined}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
});

export default ConversationList;
