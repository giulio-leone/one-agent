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
  ParallelStep,
  LoopStep,
  ConditionalStep,
  TransformStep,
  InputValue,
} from './types';

// ==================== PUBLIC API ====================

/**
 * Parse WORKFLOW.md content into WorkflowDef
 */
export function parseWorkflow(content: string): WorkflowDef {
  console.log('[Parser] Parsing workflow content, length:', content.length);

  // Try YAML-block parsing first
  const yamlSteps = parseYamlBlocks(content);
  if (yamlSteps.length > 0) {
    console.log('[Parser] Parsed', yamlSteps.length, 'steps from YAML blocks');
    return { steps: yamlSteps };
  }

  // Fallback to legacy parsing
  console.log('[Parser] No YAML blocks found, using legacy parser');
  const legacySteps = parseLegacyFormat(content);
  console.log('[Parser] Parsed', legacySteps.length, 'steps from legacy format');
  return { steps: legacySteps };
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
    const headersBetween = headers.filter((h: any) => h.pos > nearestHeader!.pos && h.pos < yaml.pos);
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

// ==================== LEGACY PARSER (FALLBACK) ====================

interface Block {
  number: number;
  name: string;
  content: string;
}

/**
 * Parse legacy WORKFLOW.md format (regex-based)
 */
function parseLegacyFormat(content: string): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  const blocks = parseBlocks(content);

  for (const block of blocks) {
    const step = parseBlockLegacy(block);
    if (step) {
      steps.push(step);
    }
  }

  return steps;
}

/**
 * Parse numbered blocks from markdown
 */
function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split('\n');
  let currentBlock: Block | null = null;

  for (const line of lines) {
    const headerMatch = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*/);
    if (headerMatch) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      const numStr = headerMatch[1];
      const name = headerMatch[2];
      if (numStr && name) {
        currentBlock = {
          number: parseInt(numStr, 10),
          name: name.trim(),
          content: '',
        };
      }
    } else if (currentBlock) {
      currentBlock.content += line + '\n';
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}

/**
 * Parse a single block into a WorkflowStep (legacy format)
 */
function parseBlockLegacy(block: Block): WorkflowStep | null {
  const content = block.content;

  // Check for Call step
  const callMatch = content.match(/Call:\s*@(.+?)(?:\n|$)/);
  if (callMatch?.[1]) {
    return parseCallStepLegacy(block.name, callMatch[1].trim(), content);
  }

  // Check for Loop step
  if (content.match(/Loop:/)) {
    return parseLoopStepLegacy(block.name, content);
  }

  // Check for Parallel step
  if (content.match(/Parallel:/)) {
    return parseParallelStepLegacy(block.name, content);
  }

  // Check for Conditional step
  const ifMatch = content.match(/If:\s*"(.+?)"/);
  if (ifMatch?.[1]) {
    return parseConditionalStepLegacy(block.name, ifMatch[1], content);
  }

  console.warn(`[Parser] Unknown block type: ${block.name}`);
  return null;
}

/**
 * Parse Call step (legacy format)
 */
function parseCallStepLegacy(name: string, agentId: string, content: string): CallStep {
  // Try to extract Input from inline JSON format
  let inputMap: Record<string, string> = {};

  // Match: Input: { key: "value", ... }
  const inputMatch = content.match(/Input:\s*(\{[^}]+\})/);
  if (inputMatch?.[1]) {
    inputMap = parseInputMapLegacy(inputMatch[1]);
    console.log(`[Parser] Legacy inputMap for ${name}:`, inputMap);
  }

  // Parse Store key
  const storeMatch = content.match(/Store:\s*(.+?)(?:\n|$)/);
  const storeKey = storeMatch?.[1]?.trim() || `artifacts.${agentId.split('/').pop()}`;

  return {
    type: 'call',
    name,
    agentId: normalizeAgentPath(agentId),
    inputMap,
    storeKey,
  };
}

/**
 * Parse Loop step (legacy format)
 */
function parseLoopStepLegacy(name: string, content: string): LoopStep {
  const overMatch = content.match(/Over:\s*"?(.+?)"?(?:\n|$)/);
  const itemMatch = content.match(/Item:\s*"(.+?)"/);
  const modeMatch = content.match(/Mode:\s*(Parallel|Sequential)/i);

  return {
    type: 'loop',
    name,
    over: overMatch?.[1]?.trim() || '',
    itemVar: itemMatch?.[1] || 'item',
    mode: modeMatch?.[1]?.toLowerCase() === 'sequential' ? 'sequential' : 'parallel',
    steps: [],
    outputKey: 'artifacts.loopResult',
  };
}

/**
 * Parse Parallel step (legacy format)
 */
function parseParallelStepLegacy(name: string, content: string): ParallelStep {
  const branches: WorkflowStep[][] = [];

  // Look for Branches: [...] pattern
  const branchMatch = content.match(/Branches:\s*\[([\s\S]*?)\]/);
  if (branchMatch?.[1]) {
    // Each @agent is a branch
    const agentMatches = branchMatch[1].matchAll(/@([^\s,\]]+)/g);
    for (const match of agentMatches) {
      const agentId = match[1];
      if (agentId) {
        branches.push([
          {
            type: 'call',
            name: agentId,
            agentId: normalizeAgentPath(agentId),
            inputMap: {},
            storeKey: `artifacts.${agentId.split('/').pop()}`,
          },
        ]);
      }
    }
  }

  return {
    type: 'parallel',
    name,
    branches,
  };
}

/**
 * Parse Conditional step (legacy format)
 */
function parseConditionalStepLegacy(
  name: string,
  condition: string,
  _content: string
): ConditionalStep {
  return {
    type: 'conditional',
    name,
    condition,
    then: [],
    else: undefined,
  };
}

/**
 * Parse input map from JSON-like string (legacy)
 */
function parseInputMapLegacy(str: string): Record<string, string> {
  const map: Record<string, string> = {};

  // Extract key-value pairs: key: "value" or key: "${template}"
  const pairs = str.matchAll(/(\w+):\s*"([^"]+)"/g);
  for (const pair of pairs) {
    const key = pair[1];
    const value = pair[2];
    if (key && value) {
      map[key] = value;
    }
  }

  // Also try key: 1 (numbers)
  const numPairs = str.matchAll(/(\w+):\s*(\d+)(?=[,}])/g);
  for (const pair of numPairs) {
    const key = pair[1];
    const value = pair[2];
    if (key && value) {
      map[key] = value;
    }
  }

  return map;
}

// ==================== UTILITIES ====================

/**
 * Normalize agent path (handle @domains/... syntax)
 */
function normalizeAgentPath(path: string): string {
  let normalized = path.startsWith('@') ? path.slice(1) : path;
  normalized = normalized.startsWith('workers/') ? normalized : path;
  return normalized.replace(/\./g, '/');
}
