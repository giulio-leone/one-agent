/**
 * OneAgent SDK v4.2 - Schema & Tools Registry
 *
 * Provides static registration for bundled environments
 * where dynamic import() doesn't work (Turbopack, Webpack, etc.)
 *
 * Usage:
 * 1. Domain packages register schemas at initialization:
 *    registerSchemas({ 'flight-search:input': FlightSearchInputSchema, ... })
 *
 * 2. Domain packages register tools at initialization:
 *    registerTools({ 'flight-search': flightSearchTools })
 *
 * 3. SDK loader/worker looks up from registry before dynamic import
 */

import type { z } from 'zod';

// Tool type (AI SDK tool definitions)
type ToolDefinition = Record<string, unknown>;

// ==================== REGISTRY STATE ====================

const schemaRegistry = new Map<string, z.ZodSchema>();
const toolsRegistry = new Map<string, Record<string, ToolDefinition>>();

// ==================== SCHEMA API ====================

/**
 * Register schemas for agents
 *
 * Called at app initialization time by domain packages.
 * Keys should follow the format: `{agentId}:{input|output}`
 *
 * @example
 * registerSchemas({
 *   'flight-search:input': FlightSearchInputSchema,
 *   'flight-search:output': FlightSearchOutputSchema,
 * });
 */
export function registerSchemas(schemas: Record<string, z.ZodSchema>): void {
  for (const [key, schema] of Object.entries(schemas)) {
    if (schemaRegistry.has(key)) {
      console.warn(`[Registry] Schema "${key}" already registered, overwriting`);
    }
    schemaRegistry.set(key, schema);
  }

  console.warn(
    `[Registry] Registered ${Object.keys(schemas).length} schemas:`,
    Object.keys(schemas)
  );
}

/**
 * Get a registered schema by key
 */
export function getSchema(key: string): z.ZodSchema | undefined {
  return schemaRegistry.get(key);
}

/**
 * Check if schemas are registered for an agent
 */
export function hasAgentSchemas(agentId: string): boolean {
  return schemaRegistry.has(`${agentId}:input`) && schemaRegistry.has(`${agentId}:output`);
}

/**
 * Get all registered schema keys
 */
export function getRegisteredSchemaKeys(): string[] {
  return Array.from(schemaRegistry.keys());
}

/**
 * Clear all registered schemas (for testing)
 */
export function clearSchemaRegistry(): void {
  schemaRegistry.clear();
}

// ==================== TOOLS API ====================

/**
 * Register local tools for agents
 *
 * Called at app initialization time by domain packages.
 * Keys should be the agentId.
 *
 * @example
 * registerTools({
 *   'flight-search': flightSearchTools,
 * });
 */
export function registerTools(tools: Record<string, Record<string, ToolDefinition>>): void {
  for (const [agentId, agentTools] of Object.entries(tools)) {
    if (toolsRegistry.has(agentId)) {
      console.warn(`[Registry] Tools for "${agentId}" already registered, merging`);
      const existing = toolsRegistry.get(agentId) ?? {};
      toolsRegistry.set(agentId, { ...existing, ...agentTools });
    } else {
      toolsRegistry.set(agentId, agentTools);
    }
  }

  console.warn(`[Registry] Registered tools for agents:`, Object.keys(tools));
}

/**
 * Get registered tools for an agent
 */
export function getAgentTools(agentId: string): Record<string, ToolDefinition> | undefined {
  return toolsRegistry.get(agentId);
}

/**
 * Get all registered tool keys
 */
export function getRegisteredToolKeys(): string[] {
  return Array.from(toolsRegistry.keys());
}

/**
 * Clear all registered tools (for testing)
 */
export function clearToolsRegistry(): void {
  toolsRegistry.clear();
}

// ==================== TRANSFORM API ====================

/**
 * Transform function signature
 * Takes resolved input and returns output to store in artifacts
 */
type TransformFn = (input: Record<string, unknown>) => unknown | Promise<unknown>;

const transformRegistry = new Map<string, TransformFn>();

/**
 * Register transform functions for workflow steps
 *
 * Called at app initialization time by domain packages.
 * Keys are the transform identifiers used in WORKFLOW.md.
 *
 * @example
 * registerTransforms({
 *   'assembleWeeksFromDiffs': assembleWeeksFromDiffs,
 *   'validateProgram': validateProgram,
 * });
 */
export function registerTransforms(transforms: Record<string, TransformFn>): void {
  for (const [key, fn] of Object.entries(transforms)) {
    if (transformRegistry.has(key)) {
      console.warn(`[Registry] Transform "${key}" already registered, overwriting`);
    }
    transformRegistry.set(key, fn);
  }

  console.warn(
    `[Registry] Registered ${Object.keys(transforms).length} transforms:`,
    Object.keys(transforms)
  );
}

/**
 * Get a registered transform function by key
 */
export function getTransform(key: string): TransformFn | undefined {
  return transformRegistry.get(key);
}

/**
 * Get all registered transform keys
 */
export function getRegisteredTransformKeys(): string[] {
  return Array.from(transformRegistry.keys());
}

/**
 * Clear all registered transforms (for testing)
 */
export function clearTransformRegistry(): void {
  transformRegistry.clear();
}

/**
 * Clear all registries (for testing)
 */
export function clearAllRegistries(): void {
  schemaRegistry.clear();
  toolsRegistry.clear();
  transformRegistry.clear();
}
