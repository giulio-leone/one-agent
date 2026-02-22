/**
 * AI Agent Setup Utility
 *
 * Utility condivisa per setup comune di agent AI:
 * - Provider e cost calculator
 * - Model configuration
 * - API key validation
 *
 * Principi: KISS, SOLID (Single Responsibility), DRY
 */

import { getModelByTier } from '@giulio-leone/lib-ai';
import { createAIProvider } from '@giulio-leone/lib-ai';
import { createCostCalculator } from '../core/CostCalculator';
import type { IAIProvider, ICostCalculator } from '../core/types';
import { TOKEN_LIMITS } from '@giulio-leone/constants';

export interface AIAgentConfig {
  provider: IAIProvider;
  costCalculator: ICostCalculator;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface CreateAIAgentConfigOptions {
  modelTier?: 'balanced' | 'fast' | 'quality';
  temperature?: number;
  maxTokens?: number;
}

/**
 * Crea configurazione comune per agent AI
 *
 * @param options Opzioni di configurazione
 * @returns Configurazione completa per agent AI
 * @throws Error se API key non configurata
 */
export async function createAIAgentConfig(
  options: CreateAIAgentConfigOptions = {}
): Promise<AIAgentConfig> {
  const {
    modelTier = 'balanced',
    temperature = 0.7,
    maxTokens = TOKEN_LIMITS.DEFAULT_MAX_TOKENS,
  } = options;

  // Get model configuration
  const modelConfig = await getModelByTier(modelTier);
  // Import dinamico per evitare che venga incluso nel bundle client
  const { AIProviderConfigService } = await import('@giulio-leone/lib-ai');
  const apiKey = await AIProviderConfigService.getApiKey(modelConfig.provider);

  if (!apiKey) {
    throw new Error(`API key non configurata per il provider ${modelConfig.provider}`);
  }

  // Create AI provider and cost calculator
  // Passiamo esplicitamente la chiave recuperata (che può venire da Edge Config)
  const provider = createAIProvider([
    {
      type: modelConfig.provider as any,
      apiKey,
    },
  ]);
  const costCalculator = createCostCalculator();

  // Normalize model name (add openrouter/ prefix if needed)
  const model = modelConfig.model.includes('/')
    ? modelConfig.model
    : `openrouter/${modelConfig.model}`;

  return {
    provider,
    costCalculator,
    model,
    temperature,
    maxTokens,
  };
}

/**
 * Factory per creare istanza di agent con configurazione comune
 *
 * @param AgentClass Classe dell'agent da istanziare
 * @param config Configurazione AI agent
 * @returns Istanza dell'agent configurata
 */
export function createAgentInstance<
  T extends new (
    provider: IAIProvider,
    costCalculator: ICostCalculator,
    model: string,
    temperature: number,
    maxTokens: number
  ) => InstanceType<T>,
>(AgentClass: T, config: AIAgentConfig): InstanceType<T> {
  return new AgentClass(
    config.provider,
    config.costCalculator,
    config.model,
    config.temperature,
    config.maxTokens
  );
}
