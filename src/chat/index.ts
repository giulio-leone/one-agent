/**
 * @onecoach/one-agent/chat
 *
 * Chat services for conversation management.
 * TODO: Implement full ConversationService with database backing.
 */

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationInput {
  userId: string;
  title?: string;
  provider?: string;
  modelId?: string;
  systemPrompt?: string;
}

export interface GetMessagesInput {
  conversationId: string;
  limit?: number;
  cursor?: string;
}

/**
 * ConversationService - manages chat conversations and messages.
 * Stub implementation; full persistence layer to be added.
 */
export const ConversationService = {
  async list(userId: string): Promise<Conversation[]> {
    throw new Error(`ConversationService.list not implemented (userId: ${userId})`);
  },

  async getById(userId: string, conversationId: string): Promise<Conversation | null> {
    throw new Error(
      `ConversationService.getById not implemented (userId: ${userId}, id: ${conversationId})`
    );
  },

  async getMessages(input: GetMessagesInput): Promise<ConversationMessage[]> {
    throw new Error(
      `ConversationService.getMessages not implemented (conversationId: ${input.conversationId})`
    );
  },

  async create(
    input: CreateConversationInput
  ): Promise<{ conversation: Conversation; messages: ConversationMessage[] }> {
    throw new Error(
      `ConversationService.create not implemented (userId: ${input.userId})`
    );
  },

  async update(
    userId: string,
    conversationId: string,
    data: Partial<Pick<Conversation, 'title'>>
  ): Promise<Conversation> {
    throw new Error(
      `ConversationService.update not implemented (userId: ${userId}, id: ${conversationId}, data: ${JSON.stringify(data)})`
    );
  },

  async delete(userId: string, conversationId: string): Promise<boolean> {
    throw new Error(
      `ConversationService.delete not implemented (userId: ${userId}, id: ${conversationId})`
    );
  },
};
