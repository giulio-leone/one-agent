/**
 * OneAgent SDK v4.2 - Prisma Persistence Adapter
 *
 * Implements PersistenceAdapter interface for storing:
 * - Execution contexts (for resume/recovery)
 * - Memory entries (for long-term learning)
 */

import { randomUUID } from 'crypto';
import type {
  PersistenceAdapter,
  Context,
  MemoryEntry,
  ExecutionMeta,
  ChatMessage,
} from '../framework/types';

// ==================== TYPES ====================

/**
 * Prisma client type - we use a generic type to avoid direct dependency
 * The actual Prisma client is injected at runtime
 */
interface PrismaClient {
  agent_executions: {
    create: (args: { data: AgentExecutionCreateInput }) => Promise<AgentExecutionRecord>;
    findUnique: (args: { where: { id: string } }) => Promise<AgentExecutionRecord | null>;
    update: (args: {
      where: { id: string };
      data: Partial<AgentExecutionCreateInput>;
    }) => Promise<AgentExecutionRecord>;
  };
  agent_memories: {
    create: (args: { data: AgentMemoryCreateInput }) => Promise<AgentMemoryRecord>;
    findMany: (args: {
      where: { userId: string; domain?: string };
      orderBy?: { createdAt: 'desc' | 'asc' };
      take?: number;
    }) => Promise<AgentMemoryRecord[]>;
    updateMany: (args: {
      where: { userId: string; agentId: string; summary?: null };
      data: { summary: string };
    }) => Promise<{ count: number }>;
  };
}

interface AgentExecutionRecord {
  id: string;
  userId: string;
  input: unknown;
  artifacts: unknown;
  memory: unknown;
  status: string;
  currentStep: string;
  tokensUsed: number;
  costUSD: number;
  error: string | null;
  startedAt: Date;
  updatedAt: Date;
}

interface AgentExecutionCreateInput {
  id?: string;
  userId: string;
  input: unknown;
  artifacts: unknown;
  memory: unknown;
  status: string;
  currentStep: string;
  tokensUsed: number;
  costUSD: number;
  error?: string | null;
  startedAt?: Date;
  updatedAt?: Date;
}

interface AgentMemoryRecord {
  id: string;
  userId: string;
  agentId: string;
  domain: string;
  type: string;
  content: string;
  data: unknown;
  importance: number;
  summary: string | null;
  createdAt: Date;
}

interface AgentMemoryCreateInput {
  id?: string;
  userId: string;
  agentId: string;
  domain: string;
  type: string;
  content: string;
  data?: unknown;
  importance: number;
  summary?: string | null;
}

// ==================== ADAPTER FACTORY ====================

/**
 * Create a Prisma persistence adapter
 *
 * @param prisma - Prisma client instance
 * @returns PersistenceAdapter implementation
 *
 * @example
 * import { PrismaClient } from '@prisma/client';
 * import { createPrismaAdapter } from '@giulio-leone/one-agent/persistence';
 *
 * const prisma = new PrismaClient();
 * const persistence = createPrismaAdapter(prisma);
 *
 * // Use in execute()
 * const result = await execute(agentPath, input, { persistence });
 */
export function createPrismaAdapter(prisma: PrismaClient): PersistenceAdapter {
  return {
    /**
     * Create a new execution context
     */
    async createContext(data): Promise<Context> {
      const executionId = randomUUID();
      const now = new Date();

      const meta: ExecutionMeta = {
        startedAt: now,
        updatedAt: now,
        currentStep: 'init',
        tokensUsed: 0,
        costUSD: 0,
        status: 'pending',
      };

      const context: Context = {
        executionId,
        userId: data.userId,
        input: data.input,
        artifacts: data.artifacts ?? {},
        memory: data.memory ?? [],
        meta,
      };

      // Persist to database
      await prisma.agent_executions.create({
        data: {
          id: executionId,
          userId: data.userId,
          input: data.input,
          artifacts: data.artifacts ?? {},
          memory: data.memory ?? [],
          status: meta.status,
          currentStep: meta.currentStep,
          tokensUsed: meta.tokensUsed,
          costUSD: meta.costUSD,
          startedAt: meta.startedAt,
          updatedAt: meta.updatedAt,
        },
      });

      return context;
    },

    /**
     * Load an existing execution context
     */
    async loadContext(executionId): Promise<Context | null> {
      const record = await prisma.agent_executions.findUnique({
        where: { id: executionId },
      });

      if (!record) {
        return null;
      }

      return {
        executionId: record.id,
        userId: record.userId,
        input: record.input,
        artifacts: record.artifacts as Record<string, unknown>,
        memory: record.memory as ChatMessage[],
        meta: {
          startedAt: record.startedAt,
          updatedAt: record.updatedAt,
          currentStep: record.currentStep,
          tokensUsed: record.tokensUsed,
          costUSD: record.costUSD,
          status: record.status as Context['meta']['status'],
          error: record.error ?? undefined,
        },
      };
    },

    /**
     * Save/update an execution context
     */
    async saveContext(context): Promise<void> {
      await prisma.agent_executions.update({
        where: { id: context.executionId },
        data: {
          artifacts: context.artifacts,
          memory: context.memory,
          status: context.meta.status,
          currentStep: context.meta.currentStep,
          tokensUsed: context.meta.tokensUsed,
          costUSD: context.meta.costUSD,
          error: context.meta.error ?? null,
          updatedAt: new Date(),
        },
      });
    },

    /**
     * Load memory entries for a user in a specific domain
     */
    async loadMemory(userId, domain, limit = 50): Promise<MemoryEntry[]> {
      const records = await prisma.agent_memories.findMany({
        where: { userId, domain },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return records.map((r: any) => ({
        id: r.id,
        userId: r.userId,
        agentId: r.agentId,
        domain: r.domain,
        type: r.type as MemoryEntry['type'],
        content: r.content,
        data: r.data as Record<string, unknown> | undefined,
        importance: r.importance,
        summary: r.summary ?? undefined,
        createdAt: r.createdAt,
      }));
    },

    /**
     * Save a new memory entry
     */
    async saveMemory(entry): Promise<MemoryEntry> {
      const id = randomUUID();

      const record = await prisma.agent_memories.create({
        data: {
          id,
          userId: entry.userId,
          agentId: entry.agentId,
          domain: entry.domain,
          type: entry.type,
          content: entry.content,
          data: entry.data,
          importance: entry.importance,
          summary: entry.summary ?? null,
        },
      });

      return {
        id: record.id,
        userId: record.userId,
        agentId: record.agentId,
        domain: record.domain,
        type: record.type as MemoryEntry['type'],
        content: record.content,
        data: record.data as Record<string, unknown> | undefined,
        importance: record.importance,
        summary: record.summary ?? undefined,
        createdAt: record.createdAt,
      };
    },

    /**
     * Summarize old memory entries for a user/agent combination
     *
     * This is a placeholder - in production, you would:
     * 1. Load unsummarized memories
     * 2. Call an LLM to summarize them
     * 3. Update the records with summaries
     */
    async summarizeMemory(userId, agentId): Promise<void> {
      // TODO: Implement memory summarization using LLM
      // For now, this is a no-op placeholder

      console.log(
        `[Persistence] Memory summarization requested for user=${userId}, agent=${agentId}`
      );

      // Example future implementation:
      // const memories = await prisma.agent_memories.findMany({
      //   where: { userId, agentId, summary: null },
      //   orderBy: { createdAt: 'asc' },
      //   take: 10,
      // });
      //
      // if (memories.length > 0) {
      //   const summary = await summarizeWithLLM(memories);
      //   await prisma.agent_memories.updateMany({
      //     where: { id: { in: memories.map(m => m.id) } },
      //     data: { summary },
      //   });
      // }
    },
  };
}

// ==================== IN-MEMORY ADAPTER (for testing) ====================

/**
 * Create an in-memory persistence adapter
 *
 * Useful for testing and development without a database.
 */
export function createInMemoryAdapter(): PersistenceAdapter {
  const contexts = new Map<string, Context>();
  const memories: MemoryEntry[] = [];

  return {
    async createContext(data): Promise<Context> {
      const executionId = randomUUID();
      const now = new Date();

      const context: Context = {
        executionId,
        userId: data.userId,
        input: data.input,
        artifacts: data.artifacts ?? {},
        memory: data.memory ?? [],
        meta: {
          startedAt: now,
          updatedAt: now,
          currentStep: 'init',
          tokensUsed: 0,
          costUSD: 0,
          status: 'pending',
        },
      };

      contexts.set(executionId, context);
      return context;
    },

    async loadContext(executionId): Promise<Context | null> {
      return contexts.get(executionId) ?? null;
    },

    async saveContext(context): Promise<void> {
      context.meta.updatedAt = new Date();
      contexts.set(context.executionId, context);
    },

    async loadMemory(userId, domain, limit = 50): Promise<MemoryEntry[]> {
      return memories
        .filter((m: any) => m.userId === userId && m.domain === domain)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
    },

    async saveMemory(entry): Promise<MemoryEntry> {
      const memoryEntry: MemoryEntry = {
        id: randomUUID(),
        ...entry,
        createdAt: new Date(),
      };
      memories.push(memoryEntry);
      return memoryEntry;
    },

    async summarizeMemory(): Promise<void> {
      // No-op for in-memory adapter
    },
  };
}
