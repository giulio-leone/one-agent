/**
 * Agent Registry Initialization
 *
 * Registers all OneAgent SDK 4.2 agents with their capabilities
 */

import { getAgentRegistry, type RegisteredAgent, type AgentCapability } from './AgentRegistry';
// Nutrition agent removed - generation is handled by PatternNutritionOrchestratorService in apps/next
// Workout agent removed - generation now uses SDK 4.2 declarative workflows via @giulio-leone/one-workout
import { createCopilotMeshCoordinator } from '../agents/copilot';
import { SDK_VERSION } from '../core/version';
import { createAIProvider } from '@giulio-leone/lib-ai';
import { createCostCalculator } from '../core/CostCalculator';
import { AIProviderConfigService } from '@giulio-leone/lib-ai';

export interface AgentModelConfig {
  // nutritionModel removed - nutrition generation uses PatternNutritionOrchestratorService
  // workoutModel removed - workout generation uses SDK 4.2 via @giulio-leone/one-workout
  copilotModel?: string;
}

const resolveModelFromAdmin = async (
  customModel: string | undefined,
  kind: 'copilot'
): Promise<string> => {
  if (customModel?.trim()) {
    return customModel.trim();
  }

  const adminModel = await AIProviderConfigService.getDefaultModel('openrouter');

  if (!adminModel) {
    throw new Error(
      `[AgentRegistry] Nessun modello configurato in admin per ${kind}. Configura un modello predefinito in /admin/ai-settings.`
    );
  }

  return adminModel;
};

/**
 * Initialize agent registry with all available agents
 */
export async function initializeAgentRegistry(
  userId?: string,
  modelConfig?: AgentModelConfig
): Promise<void> {
  const registry = getAgentRegistry();

  // Clear existing agents
  registry.clear();

  // Create AI provider and cost calculator
  const aiProvider = createAIProvider();
  const costCalculator = createCostCalculator();

  // Use provided models or fallback to defaults
  // nutritionModel removed - nutrition generation uses PatternNutritionOrchestratorService
  // workoutModel removed - workout generation uses SDK 4.2 via @giulio-leone/one-workout
  const copilotModel = await resolveModelFromAdmin(modelConfig?.copilotModel, 'copilot');

  // Register Copilot Agent
  const copilotAgent = createCopilotMeshCoordinator(aiProvider, costCalculator, copilotModel);

  const copilotCapabilities: AgentCapability[] = [
    {
      id: 'copilot.conversation',
      name: 'Conversational AI',
      description: 'Natural language conversation and assistance',
      keywords: ['chat', 'conversation', 'help', 'assistant'],
      domains: ['general', 'nutrition', 'workout', 'analytics', 'oneagenda'],
    },
    {
      id: 'copilot.orchestration',
      name: 'Multi-Agent Orchestration',
      description: 'Coordinate multiple specialized agents',
      keywords: ['orchestration', 'coordination', 'multi-agent', 'delegation'],
      domains: ['all'],
    },
    {
      id: 'copilot.memory',
      name: 'Conversation Memory',
      description: 'Remember conversation history and context',
      keywords: ['memory', 'history', 'context', 'recall'],
      domains: ['all'],
    },
  ];

  registry.register({
    id: `copilot-${userId || 'global'}`,
    name: 'onecoach Copilot',
    role: 'copilot',
    instance: copilotAgent,
    capabilities: copilotCapabilities,
    priority: 10, // Highest priority
    status: 'active',
    metadata: {
      version: SDK_VERSION,
      createdAt: new Date(),
      totalExecutions: 0,
      successRate: 1.0,
    },
  });

  // Nutrition Agent removed - generation is handled by PatternNutritionOrchestratorService
  // in apps/next/lib/services/nutrition/pattern-nutrition-orchestrator.service.ts
  // The registry is not used for nutrition plan generation

  // Workout Agent REMOVED - generation now uses SDK 4.2 declarative workflows
  // via @giulio-leone/one-workout (submodules/one-workout/src/sdk-agents/workout-generation)
  // The WorkoutMeshCoordinator is legacy and no longer used.
}

/**
 * Register all agents (convenience function)
 */
export async function registerAllAgents(userId?: string): Promise<RegisteredAgent[]> {
  await initializeAgentRegistry(userId);
  return getAgentRegistry().getAll();
}
