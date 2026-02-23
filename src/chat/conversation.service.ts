// Note: This service is server-only due to Prisma dependency

import { prisma } from '@giulio-leone/lib-core';
import { logError } from '@giulio-leone/lib-shared';
import type {
  AIProvider,
  ConversationRole,
  Prisma,
  conversation_messages as ConversationMessageModel,
  conversations as ConversationModel,
} from '@prisma/client';

export type ConversationRecord = Pick<
  ConversationModel,
  | 'id'
  | 'userId'
  | 'title'
  | 'lastMessageAt'
  | 'providerOverride'
  | 'modelOverride'
  | 'metadata'
  | 'createdAt'
  | 'updatedAt'
>;

export type ConversationMessageRecord = Pick<
  ConversationMessageModel,
  'id' | 'conversationId' | 'role' | 'content' | 'metadata' | 'sequence' | 'createdAt' | 'updatedAt'
>;

export interface ConversationCreateInput {
  userId: string;
  title?: string | null;
  metadata?: Prisma.JsonValue | null;
  providerOverride?: AIProvider | null;
  modelOverride?: string | null;
  initialMessages?: MessageInput[];
}

export interface ConversationUpdateInput {
  title?: string | null;
  metadata?: Prisma.JsonValue | null;
  providerOverride?: AIProvider | null;
  modelOverride?: string | null;
}

export interface MessageInput {
  role: ConversationRole;
  content: string;
  metadata?: Prisma.JsonValue | null;
  sequence?: number;
  occurredAt?: Date;
}

export interface MessageListParams {
  conversationId: string;
  userId: string;
  limit?: number;
  cursor?: string;
  order?: 'asc' | 'desc';
}

export class ConversationService {
  static async list(userId: string): Promise<ConversationRecord[]> {
    try {
      return await prisma.conversations.findMany({
        where: { userId },
        orderBy: [
          {
            lastMessageAt: 'desc',
          },
          {
            updatedAt: 'desc',
          },
        ],
        select: {
          id: true,
          userId: true,
          title: true,
          lastMessageAt: true,
          providerOverride: true,
          modelOverride: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: unknown) {
      logError('Failed to list conversations', error);
      throw error;
    }
  }

  static async getById(userId: string, conversationId: string): Promise<ConversationRecord | null> {
    try {
      return await prisma.conversations.findFirst({
        where: { id: conversationId, userId },
        select: {
          id: true,
          userId: true,
          title: true,
          lastMessageAt: true,
          providerOverride: true,
          modelOverride: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: unknown) {
      logError('Failed to load conversation', error);
      throw error;
    }
  }

  static async create(input: ConversationCreateInput): Promise<{
    conversation: ConversationRecord;
    messages: ConversationMessageRecord[];
  }> {
    const { userId, title, metadata, providerOverride, modelOverride, initialMessages } = input;

    try {
      const created = await prisma.conversations.create({
        data: {
          userId,
          title: title?.trim() || undefined,
          metadata: metadata ?? undefined,
          providerOverride: providerOverride ?? undefined,
          modelOverride: modelOverride?.trim() || undefined,
          lastMessageAt: new Date(),
          messages: initialMessages?.length
            ? {
                create: initialMessages.map((message, index) => ({
                  role: message.role,
                  content: message.content,
                  metadata: message.metadata ?? undefined,
                  sequence: message.sequence ?? index,
                  createdAt: message.occurredAt ?? undefined,
                })),
              }
            : undefined,
        },
        include: {
          messages: {
            orderBy: { sequence: 'asc' },
          },
        },
      });

      const { messages, ...conversation } = created;

      return {
        conversation,
        messages,
      };
    } catch (error: unknown) {
      logError('Failed to create conversation', error);
      throw error;
    }
  }

  static async update(
    userId: string,
    conversationId: string,
    data: ConversationUpdateInput
  ): Promise<ConversationRecord> {
    try {
      const conversation = await prisma.conversations.findFirst({
        where: { id: conversationId, userId },
        select: { id: true },
      });

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      return await prisma.conversations.update({
        where: { id: conversationId },
        data: {
          title: data.title === undefined ? undefined : data.title?.trim() || null,
          metadata: data.metadata === undefined ? undefined : (data.metadata as Prisma.InputJsonValue),
          providerOverride: data.providerOverride === undefined ? undefined : data.providerOverride,
          modelOverride:
            data.modelOverride === undefined ? undefined : data.modelOverride?.trim() || null,
        },
        select: {
          id: true,
          userId: true,
          title: true,
          lastMessageAt: true,
          providerOverride: true,
          modelOverride: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: unknown) {
      logError('Failed to update conversation', error);
      throw error;
    }
  }

  static async delete(userId: string, conversationId: string): Promise<boolean> {
    try {
      const conversation = await prisma.conversations.findFirst({
        where: { id: conversationId, userId },
        select: { id: true },
      });

      if (!conversation) {
        return false;
      }

      await prisma.conversations.delete({
        where: {
          id: conversationId,
        },
      });
      return true;
    } catch (error: unknown) {
      if (isNotFoundError(error)) {
        return false;
      }
      logError('Failed to delete conversation', error);
      throw error;
    }
  }

  static async appendMessage(params: {
    conversationId: string;
    userId: string;
    message: MessageInput;
  }): Promise<ConversationMessageRecord> {
    const { conversationId, userId, message } = params;

    try {
      return await prisma.$transaction(async (tx) => {
        const conversation = await tx.conversations.findFirst({
          where: { id: conversationId, userId },
          select: { id: true },
        });

        if (!conversation) {
          throw new Error('Conversation not found or access denied');
        }

        const aggregated = await tx.conversation_messages.aggregate({
          where: { conversationId },
          _max: { sequence: true },
        });

        const computedSequence = (aggregated._max.sequence ?? -1) + 1;
        const nextSequence = message.sequence ?? computedSequence;

        const createdMessage = await tx.conversation_messages.create({
          data: {
            conversationId,
            role: message.role,
            content: message.content,
            metadata: message.metadata ?? undefined,
            sequence: nextSequence,
            createdAt: message.occurredAt ?? undefined,
          },
          select: {
            id: true,
            conversationId: true,
            role: true,
            content: true,
            metadata: true,
            sequence: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await tx.conversations.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: message.occurredAt ?? new Date(),
          },
        });

        return createdMessage;
      });
    } catch (error: unknown) {
      logError('Failed to append message', error);
      throw error;
    }
  }

  static async getMessages(params: MessageListParams): Promise<ConversationMessageRecord[]> {
    const { conversationId, userId, limit = 100, cursor, order = 'asc' } = params;

    try {
      const conversation = await prisma.conversations.findFirst({
        where: { id: conversationId, userId },
        select: { id: true },
      });

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      return await prisma.conversation_messages.findMany({
        where: { conversationId },
        orderBy: { sequence: order },
        take: limit,
        ...(cursor
          ? {
              skip: 1,
              cursor: { id: cursor },
            }
          : {}),
        select: {
          id: true,
          conversationId: true,
          role: true,
          content: true,
          metadata: true,
          sequence: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: unknown) {
      logError('Failed to load conversation messages', error);
      throw error;
    }
  }
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || !error) {
    return false;
  }

  if ('code' in error && (error as { code?: string }).code === 'P2025') {
    return true;
  }

  return false;
}
