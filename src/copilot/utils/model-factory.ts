import { AIProviderFactory } from '@giulio-leone/lib-core';
import type { AIProviderType } from '@giulio-leone/lib-core';
import type { LanguageModel } from 'ai';

export interface ModelConfig {
  provider: string;
  model: string;
}

// Options are passed to streamText/generateText, not model constructor in AI SDK Core
interface CustomModelOptions {
  maxTokens?: number;
  temperature?: number;
}

export function createCustomModel(
  config: ModelConfig,
  _options: CustomModelOptions = {}, // Unused in model creation
  apiKey?: string
): Promise<LanguageModel> {
  return AIProviderFactory.getModel(config.provider as AIProviderType, config.model, {
    apiKey,
  }) as Promise<LanguageModel>;
}

export function getModelByTier(tier: 'fast' | 'balanced' | 'quality'): ModelConfig {
  switch (tier) {
    case 'fast':
      return { provider: 'google', model: 'gemini-2.0-flash-001' };
    case 'balanced':
      return { provider: 'anthropic', model: 'claude-3-5-haiku-latest' };
    case 'quality':
      return { provider: 'anthropic', model: 'claude-3-5-sonnet-latest' };
    default:
      return { provider: 'google', model: 'gemini-2.0-flash-001' };
  }
}
