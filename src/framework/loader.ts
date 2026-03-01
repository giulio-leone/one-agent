/**
 * OneAgent SDK v4.2 - Agent Loader
 *
 * Loads agent manifest from:
 * - agent.json (interface, MCP config)
 * - AGENTS.md (system prompt)
 * - WORKFLOW.md (optional, makes agent a Manager)
 * - schema.ts (Zod schemas referenced in agent.json)
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, sep, dirname } from 'path';
import type { AgentManifest, AgentJsonConfig, AgentSkillsConfig, WorkflowStep } from './types';
import { DEFAULT_AGENT_CONFIG } from './types';
import { parseWorkflow, hasWorkflow } from './parser';

/**
 * Find the monorepo root by looking for marker files.
 * Caches the result for performance.
 */
let cachedMonorepoRoot: string | null = null;

function findMonorepoRoot(): string | null {
  if (cachedMonorepoRoot !== null) {
    return cachedMonorepoRoot;
  }

  const markerFiles = ['pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json'];
  let current = process.cwd();

  // Walk up the directory tree looking for monorepo markers
  for (let i = 0; i < 10; i++) {
    for (const marker of markerFiles) {
      if (existsSync(join(current, marker))) {
        cachedMonorepoRoot = current;
        return current;
      }
    }
    const parent = resolve(current, '..');
    if (parent === current) break; // Reached filesystem root
    current = parent;
  }

  return null;
}

/**
 * Detects and normalizes bundled environment paths.
 *
 * In bundled environments (Next.js Turbopack/Webpack), __dirname gets replaced
 * with placeholder paths like "/ROOT/submodules/...". These paths don't exist
 * on the filesystem. This function detects them and resolves real paths.
 *
 * @param basePath - The provided base path (may be a bundled placeholder)
 * @param agentPath - The agent path we're trying to resolve
 * @returns A valid filesystem path
 */
export function normalizeBundledPath(basePath: string, agentPath: string): string {
  const candidatePath = resolve(basePath, agentPath);
  const agentJsonPath = join(candidatePath, 'agent.json');

  // If the path works, use it as-is
  if (existsSync(agentJsonPath)) {
    return candidatePath;
  }

  // Detect bundled placeholder paths (e.g., /ROOT/... or /__next_/...)
  const isBundledPath =
    basePath.startsWith('/ROOT/') || basePath.startsWith('/__') || !existsSync(basePath);

  if (!isBundledPath) {
    // Path looks real but agent.json not found - let the caller handle the error
    return candidatePath;
  }

  // Extract the relative portion from the bundled path
  // e.g., "/ROOT/submodules/one-flight/src" -> "submodules/one-flight/src"
  const bundledPrefixes = ['/ROOT/', '/__next_/', '/__turbopack_/'];
  let relativePortion = basePath;
  for (const prefix of bundledPrefixes) {
    if (basePath.startsWith(prefix)) {
      relativePortion = basePath.slice(prefix.length);
      break;
    }
  }

  // Find monorepo root and resolve from there
  const monorepoRoot = findMonorepoRoot();
  if (monorepoRoot) {
    const candidate = join(monorepoRoot, relativePortion, agentPath);
    if (existsSync(join(candidate, 'agent.json'))) {
      console.warn(`[Loader] Resolved bundled path: ${basePath} -> ${candidate}`);
      return candidate;
    }
  }

  // Fallback: return original (will fail with a clear error message)
  return candidatePath;
}

/**
 * Load an agent manifest from a directory path
 *
 * @param agentPath - Path to agent directory (e.g., "domains/workout/agents/exercise-selection")
 * @param basePath - Base path to resolve relative paths
 */
export async function loadAgentManifest(
  agentPath: string,
  basePath: string = process.cwd()
): Promise<AgentManifest> {
  // Normalize bundled paths (handles Turbopack/Webpack __dirname replacement)
  const fullPath = normalizeBundledPath(basePath, agentPath);

  // 1. Load agent.json (required)
  const agentJsonPath = join(fullPath, 'agent.json');
  const agentJson = await loadAgentJsonConfig(agentJsonPath);

  // 2. Load AGENTS.md (required)
  const agentsMdPath = join(fullPath, 'AGENTS.md');
  let systemPrompt = '';
  if (existsSync(agentsMdPath)) {
    systemPrompt = await loadMarkdownContent(agentsMdPath);
  } else {
    console.warn(`[Loader] AGENTS.md not found at: ${agentsMdPath}`);
  }

  // 3. Load WORKFLOW.md (optional - determines Manager mode)
  const workflowMdPath = join(fullPath, 'WORKFLOW.md');
  let workflow;
  if (existsSync(workflowMdPath)) {
    const workflowContent = await readFile(workflowMdPath, 'utf-8');
    if (hasWorkflow(workflowContent)) {
      workflow = parseWorkflow(workflowContent);
    }
  }

  // 4. Load schemas from schema.ts references (passing agentId for registry key derivation)
  const inputSchema = await loadSchemaRef(agentJson.interface.input.$ref, fullPath, agentJson.id);
  const outputSchema = await loadSchemaRef(agentJson.interface.output.$ref, fullPath, agentJson.id);

  // 5. Build manifest
  const manifest: AgentManifest = {
    id: agentJson.id,
    version: agentJson.version,
    type: agentJson.type,
    path: fullPath,
    interface: {
      input: inputSchema,
      output: outputSchema,
    },
    systemPrompt,
    workflow,
    mcpServers: agentJson.mcpServers,
    skills: agentJson.skills,
    tools: agentJson.tools,
    progress: agentJson.progress,
    config: {
      ...DEFAULT_AGENT_CONFIG,
      ...agentJson.config,
    },
  };

  return manifest;
}

/**
 * Load markdown content, stripping YAML frontmatter if present
 */
async function loadMarkdownContent(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8');

  // Strip YAML frontmatter
  const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (frontmatterMatch?.[1]) {
    return frontmatterMatch[1].trim();
  }

  return content.trim();
}

/**
 * Load a Zod schema from a $ref path (FAIL-FAST - no silent fallbacks)
 *
 * Supports two formats:
 * 1. Registry key: "{agentId}:{input|output}" (preferred for bundled envs)
 * 2. File path: "./schema.ts#SchemaName" (fallback, requires dynamic import)
 *
 * When agentId is provided and ref uses file format, automatically derives
 * the registry key to support bundled environments like Next.js Turbopack.
 *
 * @param ref - Schema reference from agent.json
 * @param basePath - Base path for resolving file refs
 * @param agentId - Optional agent ID for deriving registry key
 * @throws Error if schema cannot be loaded (no silent z.any() fallback)
 */
async function loadSchemaRef(
  ref: string,
  basePath: string,
  agentId?: string
): Promise<import('zod').ZodSchema> {
  const { getSchema } = await import('./registry');

  // 1. Try registry first (preferred for bundled environments)
  const registrySchema = getSchema(ref);
  if (registrySchema) {
    console.warn(`[Loader] Schema loaded from registry: ${ref}`);
    return registrySchema;
  }

  // 2. If file ref format and agentId provided, derive registry key
  if (ref.includes('#') && agentId) {
    // Derive input/output from schema name (e.g., "WorkoutGenerationInputSchema" → "input")
    const schemaType = ref.toLowerCase().includes('input') ? 'input' : 'output';
    const registryKey = `${agentId}:${schemaType}`;

    const derivedSchema = getSchema(registryKey);
    if (derivedSchema) {
      console.warn(`[Loader] Schema loaded from registry (derived): ${ref} → ${registryKey}`);
      return derivedSchema;
    }
  }

  // 3. Fallback to file path format: "./schema.ts#InputSchema"
  if (!ref.includes('#')) {
    throw new Error(
      `[Loader] Schema "${ref}" not found.\n` +
        `Options:\n` +
        `  1. Register it: registerSchemas({ '${ref}': YourSchema })\n` +
        `  2. Use file ref format: './schema.ts#SchemaName'`
    );
  }

  const parts = ref.split('#');
  const filePath = parts[0];
  const schemaName = parts[1];

  if (!filePath || !schemaName) {
    throw new Error(
      `[Loader] Invalid schema ref format: "${ref}". Expected: "./schema.ts#SchemaName"`
    );
  }

  const fullPath = resolve(basePath, filePath);

  try {
    // Dynamic import of the schema file (may fail in bundled envs)
    const schemaModule = await import(fullPath);
    const schema = schemaModule[schemaName];

    if (!schema) {
      throw new Error(`Schema "${schemaName}" not found in ${fullPath}`);
    }

    console.warn(`[Loader] Schema loaded via dynamic import: ${ref}`);
    return schema;
  } catch (error) {
    throw new Error(
      `[Loader] Failed to load schema: "${ref}".\n` +
        `Cause: ${error instanceof Error ? error.message : String(error)}\n\n` +
        `Tip: Register schemas using registerSchemas() for bundled environments.\n` +
        `Example: registerSchemas({ '${ref}': YourSchema })`
    );
  }
}

/**
 * Load agent.json config from path
 */
export async function loadAgentJsonConfig(agentJsonPath: string): Promise<AgentJsonConfig> {
  if (!existsSync(agentJsonPath)) {
    throw new Error(`[Loader] agent.json not found at: ${agentJsonPath}`);
  }

  const agentJsonContent = await readFile(agentJsonPath, 'utf-8');
  return JSON.parse(agentJsonContent) as AgentJsonConfig;
}

/**
 * Resolve skills directory path from config (default: "skills")
 */
function resolveSkillsPath(agentPath: string, skillsConfig?: AgentSkillsConfig): string | null {
  const relativePath = skillsConfig?.path ?? 'skills';
  const skillsPath = join(agentPath, relativePath);
  return existsSync(skillsPath) ? skillsPath : null;
}

/**
 * Load skill files from a skills directory
 */
export async function loadSkills(
  agentPath: string,
  skillsConfig?: AgentSkillsConfig
): Promise<Record<string, string>> {
  const skillsPath = resolveSkillsPath(agentPath, skillsConfig);
  const skills: Record<string, string> = {};

  if (!skillsPath) {
    return skills;
  }

  const { readdir } = await import('fs/promises');
  const files = await readdir(skillsPath);

  for (const file of files) {
    if (file.endsWith('.skill.md')) {
      const skillName = file.replace('.skill.md', '');
      const content = await loadMarkdownContent(join(skillsPath, file));
      skills[skillName] = content;
    }
  }

  return skills;
}

/**
 * Load skills for an agent, including exposed child skills for managers.
 */
export async function loadAgentSkills(manifest: AgentManifest): Promise<Record<string, string>> {
  const ownSkills = await loadSkills(manifest.path, manifest.skills);

  if (!manifest.workflow) {
    return ownSkills;
  }

  const childSkills = await loadExposedChildSkills(manifest);
  return { ...ownSkills, ...childSkills };
}

async function loadExposedChildSkills(manifest: AgentManifest): Promise<Record<string, string>> {
  const steps = manifest.workflow?.steps ?? [];
  const childAgentIds = collectCallAgentIds(steps);
  const merged: Record<string, string> = {};

  for (const agentId of childAgentIds) {
    try {
      const childAgentPath = resolveChildAgentPath(manifest, agentId);
      const childConfig = await loadAgentJsonConfig(join(childAgentPath, 'agent.json'));

      if (!childConfig.skills?.expose) {
        continue;
      }

      const childSkills = await loadSkills(childAgentPath, childConfig.skills);
      for (const [skillName, content] of Object.entries(childSkills)) {
        const namespaced = `${childConfig.id}:${skillName}`;
        merged[namespaced] = content;
      }
    } catch (error) {
      console.warn(`[Loader] Failed to load child skills for ${agentId}:`, error);
    }
  }

  return merged;
}

function collectCallAgentIds(steps: WorkflowStep[]): string[] {
  const ids = new Set<string>();

  const visit = (step: WorkflowStep): void => {
    switch (step.type) {
      case 'call':
        ids.add(step.agentId);
        break;
      case 'parallel':
        step.branches.flat().forEach(visit);
        break;
      case 'loop':
        step.steps.forEach(visit);
        break;
      case 'conditional':
        step.then.forEach(visit);
        step.else?.forEach(visit);
        break;
      case 'transform':
        break;
    }
  };

  steps.forEach(visit);
  return Array.from(ids);
}

function resolveChildAgentPath(parentManifest: AgentManifest, agentId: string): string {
  if (agentId.startsWith('workers/')) {
    return join(parentManifest.path, agentId);
  }

  if (agentId.startsWith('sdk-agents/')) {
    const marker = `${sep}sdk-agents${sep}`;
    const markerIndex = parentManifest.path.lastIndexOf(marker);
    const basePath =
      markerIndex >= 0 ? parentManifest.path.slice(0, markerIndex) : dirname(parentManifest.path);
    return normalizeBundledPath(basePath, agentId);
  }

  return join(parentManifest.path, agentId);
}

/**
 * Check if an agent is a Manager (has WORKFLOW.md)
 */
export function isManager(manifest: AgentManifest): boolean {
  return manifest.workflow !== undefined;
}

/**
 * Get all agent paths in a domain
 */
export async function discoverAgents(domainPath: string): Promise<string[]> {
  const agentsPath = join(domainPath, 'agents');
  const agents: string[] = [];

  if (!existsSync(agentsPath)) {
    return agents;
  }

  const { readdir, stat } = await import('fs/promises');
  const entries = await readdir(agentsPath);

  for (const entry of entries) {
    const entryPath = join(agentsPath, entry);
    const entryStat = await stat(entryPath);

    if (entryStat.isDirectory()) {
      const agentJsonPath = join(entryPath, 'agent.json');
      if (existsSync(agentJsonPath)) {
        agents.push(entryPath);
      }
    }
  }

  return agents;
}
