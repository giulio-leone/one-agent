/**
 * OneAgent SDK 4.2 - Core Types
 *
 * Following SOLID principles with clear interfaces
 */

import type { z } from 'zod';

/**
 * Base agent configuration
 */
export interface AgentConfig<TInput, TOutput> {
  model: string;
  temperature?: number;
  maxTokens: number;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
}

/**
 * Agent execution result
 */
export interface AgentResult<TOutput> {
  output: TOutput;
  summary: string;
  warnings: string[];
  recommendations: string[];
  tokensUsed: number;
  costUSD: number;
  generatedAt: Date;
}

/**
 * Agent execution error
 */
export interface AgentError {
  message: string;
  code: string;
  details: unknown;
  recoverable: boolean;
}

/**
 * Streaming event types
 */
export type StreamEvent<TOutput> =
  | { type: 'start'; data: { timestamp: Date } }
  | { type: 'progress'; data: { message: string; percentage: number } }
  | { type: 'partial'; data: { output: Partial<TOutput> } }
  | { type: 'complete'; data: AgentResult<TOutput> }
  | { type: 'error'; data: AgentError };

/**
 * Base Agent Interface (Interface Segregation Principle)
 */
export interface IAgent<TInput, TOutput> {
  generate(input: TInput): Promise<AgentResult<TOutput>>;
  stream(input: TInput): AsyncGenerator<StreamEvent<TOutput>>;
  validate(data: unknown): data is TOutput;
}

/**
 * AI Provider Interface (Dependency Inversion Principle)
 */
// Re-export IChatService from @giulio-leone/types for backwards compatibility
export type { IChatService } from '@giulio-leone/contracts';

export interface IAIProvider {
  generateStructuredOutput<T>(params: {
    model: string;
    schema: z.ZodSchema<T>;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens: number;
    onLog?: (message: string, metadata?: unknown) => void;
    abortSignal?: AbortSignal; // AI SDK v6 native timeout support
  }): Promise<{
    output: T;
    usage: { totalTokens: number; costUSD?: number }; // Cost from Usage Accounting when available
  }>;

  generateText(params: {
    model: string;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens: number;
  }): Promise<{
    text: string;
    usage: { totalTokens: number; costUSD?: number }; // Cost from Usage Accounting when available
  }>;

  streamText(params: {
    model: string;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens: number;
  }): AsyncIterable<string>;

  streamStructuredOutput<T>(params: {
    model: string;
    schema: z.ZodSchema<T>;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens: number;
    onLog?: (message: string, metadata?: unknown) => void;
    abortSignal?: AbortSignal;
    onError?: (error: unknown) => void;
  }): {
    partialOutputStream: AsyncIterable<Partial<T>>;
    output: Promise<T>;
    usage: Promise<{ totalTokens: number; costUSD?: number }>;
  };
}

/**
 * Prompt Builder Interface (Single Responsibility Principle)
 */
export interface IPromptBuilder<TInput> {
  buildSystemPrompt(): string;
  buildUserPrompt(input: TInput): string;
}

/**
 * Cost Calculator Interface (Single Responsibility Principle)
 */
export interface ICostCalculator {
  calculateCost(model: string, tokensUsed: number): number;
}
