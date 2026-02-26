/**
 * @onecoach/one-agent/chat/types
 *
 * Shared type definitions for the chat module.
 * TODO: Move to @onecoach/types-chat when stabilized.
 */

export type { UIMessage } from 'ai';

export interface ChatConversation {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatFeatureFlags {
  reasoning?: boolean;
  orchestration?: boolean;
  multiAgent?: boolean;
  streaming?: boolean;
  [key: string]: boolean | undefined;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  tier?: string;
}

export type UserRole = 'USER' | 'COACH' | 'ADMIN' | 'SUPER_ADMIN';

export type ChatDomain = 'general' | 'workout' | 'nutrition' | 'flight' | 'agenda';

export interface ScreenContextType {
  screen: string;
  domain?: ChatDomain;
  metadata?: Record<string, unknown>;
}
