/**
 * Copilot SDK 4.2 Input/Output Schemas
 */
import { z } from 'zod';
import { registerSchemas } from '@giulio-leone/one-agent/framework';

// ============================================================================
// Input Schema
// ============================================================================

export const CopilotInputSchema = z.object({
  /** User's query or message */
  query: z.string().describe('User query or message'),
  
  /** User ID for context */
  userId: z.string().describe('User ID'),
  
  /** Optional conversation history */
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional(),
  
  /** MCP context from UI */
  context: z.object({
    domain: z.enum(['nutrition', 'workout', 'flight', 'oneagenda', 'general']).optional(),
    nutrition: z.record(z.string(), z.unknown()).optional(),
    workout: z.record(z.string(), z.unknown()).optional(),
    oneAgenda: z.record(z.string(), z.unknown()).optional(),
    route: z.string().optional(),
    locale: z.string().optional(),
  }).optional(),
});

export type CopilotInput = z.infer<typeof CopilotInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const CopilotOutputSchema = z.object({
  /** Main response text to user - streamed progressively */
  message: z.string().describe('Response message to show the user'),
  
  /** Detected domain */
  domain: z.enum(['nutrition', 'workout', 'flight', 'oneagenda', 'general']),
  
  /** Delegation action if needed */
  delegation: z.object({
    required: z.boolean().describe('Whether to delegate to a domain agent'),
    domain: z.enum(['nutrition', 'workout', 'flight', 'oneagenda']).optional(),
    reason: z.string().optional(),
  }).optional(),
  
  /** Actions taken */
  actions: z.array(z.object({
    type: z.string(),
    description: z.string(),
    success: z.boolean(),
  })).optional(),
  
  /** Suggested follow-ups */
  suggestions: z.array(z.string()).optional(),
});

export type CopilotOutput = z.infer<typeof CopilotOutputSchema>;

// ============================================================================
// Domain Detection Result
// ============================================================================

export const DomainDetectionSchema = z.object({
  domain: z.enum(['nutrition', 'workout', 'flight', 'oneagenda', 'general']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

export type DomainDetection = z.infer<typeof DomainDetectionSchema>;

// ============================================================================
// Register Schemas
// ============================================================================

export function registerCopilotSchemas() {
  registerSchemas({
    'copilot:input': CopilotInputSchema,
    'copilot:output': CopilotOutputSchema,
    'copilot:domain-detection': DomainDetectionSchema,
  });
}
