/**
 * Type Helpers
 *
 * Utility types and helpers for strong typing throughout the codebase.
 * Replaces `unknown` types with proper type definitions.
 */

import type { z } from 'zod';
export { handleError } from '@giulio-leone/lib-ai';

/**
 * Macros per 100g - Standard nutritional macro structure
 */
export interface MacrosPer100g {
  protein: number;
  carbs: number;
  fats: number;
  calories: number;
  fiber?: number;
}

/**
 * Log metadata - Flexible metadata object for logging
 * Uses JsonValue to avoid circular reference, but allows unknown for flexibility
 */
export type LogMetadata = Record<string, JsonValue | unknown>;

/**
 * JSON value type - For truly dynamic JSON structures
 * Includes Zod error types for error logging
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | { [key: string]: JsonValue | unknown }; // Allow unknown for Zod errors and other complex types

/**
 * Metadata type - For objects with known properties + index signature
 */
export interface Metadata {
  [key: string]: JsonValue;
}

/**
 * Base mesh agent type - Union type for agent instances
 * Used when generics cannot be determined at compile time
 */
export type BaseMeshAgent = import('../mesh/MeshAgent').MeshAgent<unknown, unknown>;
export type BaseMeshCoordinator = import('../mesh/MeshCoordinator').MeshCoordinator<
  unknown,
  unknown
>;
export type BaseMeshAgentOrCoordinator = BaseMeshAgent | BaseMeshCoordinator;

/**
 * OpenRouter Usage Accounting metadata structure
 */
export interface OpenRouterUsage {
  cost?: number;
  totalTokens?: number;
  cachedTokens?: number;
}

export interface OpenRouterMetadata {
  openrouter?: {
    usage?: OpenRouterUsage;
  };
}

/**
 * MiniMax-specific model names
 * https://platform.minimax.io/docs/api-reference/text-anthropic-api
 */
export const MINIMAX_MODEL_NAMES = ['MiniMax-M2', 'MiniMax-M2-Stable', 'MiniMax-M2.1'] as const;

export type MinimaxModelName = (typeof MINIMAX_MODEL_NAMES)[number];

/**
 * MiniMax provider options for Anthropic SDK
 * Used when calling MiniMax via the Anthropic-compatible API
 */
export interface MinimaxProviderOptions {
  anthropic?: {
    /** Enable/disable sending reasoning content in requests */
    sendReasoning?: boolean;
    /** Thinking configuration for interleaved thinking */
    thinking?: {
      type: 'enabled' | 'disabled';
      budgetTokens?: number;
    };
  };
}

/**
 * AI Provider instance type - Union of all possible provider types
 * Used when provider type cannot be determined at compile time
 */
export type AIProviderInstance =
  | ReturnType<typeof import('@ai-sdk/openai').createOpenAI>
  | typeof import('@ai-sdk/openai').openai
  | typeof import('@ai-sdk/anthropic').anthropic
  | typeof import('@ai-sdk/google').google
  | typeof import('@ai-sdk/xai').xai;

/**
 * GenerateObject parameters for AI SDK
 */
export interface GenerateObjectParams<T> {
  model: ReturnType<AIProviderInstance>;
  schema: z.ZodSchema<T>;
  prompt: string;
  system?: string;
  temperature: number;
  maxTokens: number;
  providerOptions?: {
    openrouter?: {
      usage?: {
        include: boolean;
      };
    };
    anthropic?: MinimaxProviderOptions['anthropic'];
  };
}

/**
 * StreamText parameters for AI SDK
 */
export interface StreamTextParams {
  model: ReturnType<AIProviderInstance>;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  temperature: number;
  providerOptions?: {
    openrouter?: {
      usage?: {
        include: boolean;
      };
    };
    anthropic?: MinimaxProviderOptions['anthropic'];
  };
}
