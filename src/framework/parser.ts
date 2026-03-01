/**
 * OneAgent SDK v4.2 - WORKFLOW.md Parser
 *
 * Robust parser supporting two formats:
 * 1. YAML fenced blocks (recommended, structured)
 * 2. Legacy inline format (fallback, regex-based)
 *
 * YAML format example:
 * ```yaml
 * call: workers/exercise-selector
 * input:
 *   goals: ${input.goals}
 *   userProfile: ${input.userProfile}
 * store: selectedExercises
 * ```
 */

import YAML from 'yaml';
import type {
  WorkflowDef,
  WorkflowStep,
  CallStep,
  TransformStep,
  InputValue,
} from './types';

// ==================== PUBLIC API ====================

/**
 * Parse WORKFLOW.md content into WorkflowDef
 */
export function parseWorkflow(content: string): WorkflowDef {
  console.warn('[Parser] Parsing workflow content, length:', content.length);

  // Try YAML-block parsing first
  const yamlSteps = parseYamlBlocks(content);
  if (yamlSteps.length > 0) {
    console.warn('[Parser] Parsed', yamlSteps.length, 'steps from YAML blocks');
    return { steps: yamlSteps };
  }

  // No YAML blocks found — legacy format is no longer supported
  console.warn('[Parser] No YAML blocks found. Legacy inline format has been removed. Use YAML format.');
  return { steps: [] };
}

/**
 * Check if a WORKFLOW.md file indicates Manager mode
 */
export function hasWorkflow(content: string): boolean {
  return (
    content.trim().length > 0 &&
    (content.includes('call:') ||
      content.includes('Call:') ||
      content.includes('loop:') ||
      content.includes('Loop:') ||
      content.includes('parallel:') ||
      content.includes('Parallel:'))
  );
}

// ==================== YAML BLOCK PARSER ====================

interface YamlStepDef {
  call?: string;
  transform?: string;
  loop?: {
    over: string;
    item?: string;
    mode?: 'parallel' | 'sequential';
    steps?: YamlStepDef[];
  };
  parallel?: { branches: YamlStepDef[][] };
  if?: string;
  then?: YamlStepDef[];
  else?: YamlStepDef[];
  input?: Record<string, unknown>;
  store?: string;
  output?: string;
  weight?: number;
  retry?: {
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    onFailure?: 'abort' | 'continue';
    fallbackStore?: string;
  };
}

/**
 * Parse YAML fenced blocks from markdown
 * Uses a two-pass approach:
 * 1. Find all numbered headers (## N. Name)
 * 2. Find all YAML blocks and associate each with its nearest preceding header
 * This robustly handles any explanatory text between headers and YAML blocks.
 */
function parseYamlBlocks(content: string): WorkflowStep[] {
  const steps: WorkflowStep[] = [];

  // Pass 1: Find all numbered headers with their positions
  const headerRegex = /^##?\s*(\d+)\.\s*(.+?)$/gm;
  const headers: Array<{ num: number; name: string; pos: number }> = [];
  let headerMatch;
  while ((headerMatch = headerRegex.exec(content)) !== null) {
    headers.push({
      num: parseInt(headerMatch[1]!, 10),
      name: headerMatch[2]!.replace(/\*+/g, '').trim(),
      pos: headerMatch.index,
    });
  }

  // Pass 2: Find all YAML blocks with their positions
  const yamlBlockRegex = /```(?:yaml|yml)\s*\n([\s\S]*?)```/g;
  const yamlBlocks: Array<{ content: string; pos: number }> = [];
  let yamlMatch;
  while ((yamlMatch = yamlBlockRegex.exec(content)) !== null) {
    yamlBlocks.push({
      content: yamlMatch[1]!,
      pos: yamlMatch.index,
    });
  }

  // Pass 3: Associate each YAML block with its nearest preceding header
  for (const yaml of yamlBlocks) {
    // Find the header that immediately precedes this YAML block
    let nearestHeader: (typeof headers)[0] | null = null;
    for (const h of headers) {
      if (h.pos < yaml.pos) {
        if (!nearestHeader || h.pos > nearestHeader.pos) {
          nearestHeader = h;
        }
      }
    }

    if (!nearestHeader) continue;

    // Check if another header exists between this header and the YAML
    // (which would mean this YAML belongs to a different step)
    const headersBetween = headers.filter((h: { num: number; name: string; pos: number }) => h.pos > nearestHeader!.pos && h.pos < yaml.pos);
    if (headersBetween.length > 0) {
      // YAML belongs to the closest header before it
      nearestHeader = headersBetween[headersBetween.length - 1]!;
    }

    try {
      const parsed = YAML.parse(yaml.content) as YamlStepDef;
      const step = buildStepFromYaml(nearestHeader.name, parsed);
      if (step) {
        steps.push(step);
      }
    } catch (error) {
      console.error(`[Parser] Failed to parse YAML block for "${nearestHeader.name}":`, error);
    }
  }

  // Sort steps by header position to maintain workflow order
  return steps;
}

/**
 * Build a WorkflowStep from parsed YAML definition
 */
function buildStepFromYaml(name: string, def: YamlStepDef): WorkflowStep | null {
  // Handle Call step
  if (def.call) {
    const inputMap = normalizeInputMap(def.input || {});
    const callStep: CallStep = {
      type: 'call',
      name,
      agentId: normalizeAgentPath(def.call),
      inputMap,
      storeKey: def.store || `artifacts.${def.call.split('/').pop()}`,
      weight: def.weight,
    };
    // Add retry config if specified
    if (def.retry) {
      callStep.retry = {
        maxAttempts: def.retry.maxAttempts ?? 2,
        delayMs: def.retry.delayMs ?? 1000,
        backoffMultiplier: def.retry.backoffMultiplier ?? 1.5,
        onFailure: def.retry.onFailure ?? 'abort',
        fallbackStore: def.retry.fallbackStore,
      };
    }
    return callStep;
  }

  // Handle Loop step
  if (def.loop) {
    const nestedSteps: WorkflowStep[] = [];
    if (def.loop.steps) {
      for (const nestedDef of def.loop.steps) {
        const nested = buildStepFromYaml('nested', nestedDef);
        if (nested) nestedSteps.push(nested);
      }
    }
    return {
      type: 'loop',
      name,
      over: def.loop.over,
      itemVar: def.loop.item || 'item',
      mode: def.loop.mode || 'parallel',
      steps: nestedSteps,
      outputKey: def.output || 'artifacts.loopResult',
      weight: def.weight,
    };
  }

  // Handle Parallel step
  if (def.parallel) {
    const branches: WorkflowStep[][] = [];
    for (const branchDefs of def.parallel.branches) {
      const branchSteps: WorkflowStep[] = [];
      for (const branchDef of branchDefs) {
        const step = buildStepFromYaml('branch', branchDef);
        if (step) branchSteps.push(step);
      }
      branches.push(branchSteps);
    }
    return {
      type: 'parallel',
      name,
      branches,
      weight: def.weight,
    };
  }

  // Handle Conditional step
  if (def.if) {
    const thenSteps: WorkflowStep[] = [];
    const elseSteps: WorkflowStep[] = [];
    if (def.then) {
      for (const stepDef of def.then) {
        const step = buildStepFromYaml('then', stepDef);
        if (step) thenSteps.push(step);
      }
    }
    if (def.else) {
      for (const stepDef of def.else) {
        const step = buildStepFromYaml('else', stepDef);
        if (step) elseSteps.push(step);
      }
    }
    return {
      type: 'conditional',
      name,
      condition: def.if,
      then: thenSteps,
      else: elseSteps.length > 0 ? elseSteps : undefined,
      weight: def.weight,
    };
  }

  // Handle Transform step
  if (def.transform) {
    const inputMap = normalizeInputMap(def.input || {});
    const transformStep: TransformStep = {
      type: 'transform',
      name,
      transformId: def.transform,
      inputMap,
      storeKey: def.store || `artifacts.${def.transform}`,
      weight: def.weight,
    };
    return transformStep;
  }

  console.warn(`[Parser] Unknown step type in YAML:`, def);
  return null;
}

/**
 * Normalize input map - preserve types, only format strings as templates if needed
 */
function normalizeInputMap(input: Record<string, unknown>): Record<string, InputValue> {
  const result: Record<string, InputValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      // Keep strings as-is (templates like ${...} or literals)
      result[key] = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      // Preserve primitive types
      result[key] = value;
    } else if (Array.isArray(value)) {
      // Preserve arrays
      result[key] = value;
    } else if (value !== null && typeof value === 'object') {
      // Preserve objects
      result[key] = value as Record<string, unknown>;
    }
  }
  return result;
}

