/**
 * OneAgent SDK v4.2 - MCP Integration
 *
 * Handles Model Context Protocol server lifecycle and tool mapping.
 * Supports both stdio and HTTP/SSE transports with auto-detection.
 * Converts MCP tools to AI SDK compatible format.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { MCPServerConfig, MCPTool } from './types';
import { z } from 'zod';
import { SDK_VERSION } from '../core/version';

// ==================== TYPES ====================

interface MCPConnection {
  client: Client;
  transport: StdioClientTransport | SSEClientTransport;
  tools: MCPTool[];
}

// Active connections cache
const connections = new Map<string, MCPConnection>();

// ==================== PUBLIC API ====================

/**
 * Connect to MCP servers and retrieve available tools
 *
 * @param servers - MCP server configurations
 * @returns Array of MCP tool definitions (can be used with generateText)
 */
export async function connectToMCPServers(
  servers: Record<string, MCPServerConfig>
): Promise<MCPTool[]> {
  const allTools: MCPTool[] = [];

  for (const [serverName, config] of Object.entries(servers)) {
    try {
      const connection = await getOrCreateConnection(serverName, config);
      allTools.push(...connection.tools);
    } catch (error) {
      console.error(`[MCP] Failed to connect to server "${serverName}":`, error);
    }
  }

  return allTools;
}

/**
 * Convert MCP tools to AI SDK Tool format
 *
 * This creates a tools object that can be passed to generateText or streamText.
 * Note: Due to AI SDK's type inference, the resulting tools may have `any` types.
 */
export function mcpToolsToAiSdk(
  mcpTools: MCPTool[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  for (const mcpTool of mcpTools) {
    const schema = jsonSchemaToZod(mcpTool.inputSchema);
    tools[mcpTool.name] = {
      description: mcpTool.description,
      inputSchema: schema,
      execute: async (args: unknown) => {
        console.log(
          `[MCP Tool] Calling "${mcpTool.name}" with args:`,
          JSON.stringify(args, null, 2)
        );
        try {
          const result = await mcpTool.execute(args);
          console.log(
            `[MCP Tool] "${mcpTool.name}" returned:`,
            typeof result === 'string'
              ? result.substring(0, 500) + (result.length > 500 ? '...' : '')
              : JSON.stringify(result).substring(0, 500)
          );
          return result;
        } catch (error) {
          console.error(`[MCP Tool] "${mcpTool.name}" error:`, error);
          throw error;
        }
      },
    };
  }

  return tools;
}

/**
 * Disconnect from all MCP servers
 */
export async function disconnectAllMCPServers(): Promise<void> {
  for (const [name, connection] of connections) {
    try {
      await connection.transport.close();
      console.log(`[MCP] Disconnected from server "${name}"`);
    } catch (error) {
      console.warn(`[MCP] Error disconnecting from "${name}":`, error);
    }
  }
  connections.clear();
}

/**
 * Disconnect from a specific MCP server
 */
export async function disconnectMCPServer(serverName: string): Promise<void> {
  const connection = connections.get(serverName);
  if (connection) {
    await connection.transport.close();
    connections.delete(serverName);
  }
}

// ==================== INTERNAL ====================

/**
 * Get existing connection or create a new one
 * Auto-detects transport type based on config:
 * - If 'url' is present: uses HTTP/SSE transport
 * - If 'command' is present: uses stdio transport
 */
async function getOrCreateConnection(
  name: string,
  config: MCPServerConfig
): Promise<MCPConnection> {
  // Return cached connection if available
  if (connections.has(name)) {
    return connections.get(name)!;
  }

  // Auto-detect transport type
  const isHttpTransport = !!config.url;

  let transport: StdioClientTransport | SSEClientTransport;

  if (isHttpTransport) {
    // HTTP/SSE transport (e.g., Kiwi.com: https://mcp.kiwi.com)
    console.log(`[MCP] Connecting to "${name}" via HTTP/SSE: ${config.url}`);
    transport = new SSEClientTransport(new URL(config.url!));
  } else {
    // Stdio transport (e.g., local MCP servers spawned via command)
    if (!config.command) {
      throw new Error(`MCP server "${name}" must have either 'url' or 'command' configured`);
    }

    // Filter out undefined values from env
    const envVars: Record<string, string> = {};
    for (const [key, value] of Object.entries({ ...process.env, ...config.env })) {
      if (value !== undefined) {
        envVars[key] = value;
      }
    }

    console.log(
      `[MCP] Connecting to "${name}" via stdio: ${config.command} ${config.args?.join(' ') ?? ''}`
    );
    transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      env: envVars,
    });
  }

  const client = new Client({ name: 'OneAgent', version: SDK_VERSION }, { capabilities: {} });

  await client.connect(transport);

  // Fetch available tools
  const { tools: serverTools } = await client.listTools();

  const tools: MCPTool[] = serverTools.map((t: { name: string; description?: string; inputSchema?: Record<string, unknown> }) => ({
    name: t.name,
    description: t.description ?? '',
    inputSchema: t.inputSchema as Record<string, unknown>,
    execute: async (args: unknown) => {
      const result = await client.callTool({
        name: t.name,
        arguments: args as Record<string, unknown>,
      });
      return result.content;
    },
  }));

  const connection: MCPConnection = { client, transport, tools };
  connections.set(name, connection);

  console.log(
    `[MCP] Connected to "${name}" (${isHttpTransport ? 'HTTP/SSE' : 'stdio'}), ${tools.length} tools available`
  );

  return connection;
}

/**
 * Convert JSON Schema to Zod schema (simplified)
 *
 * For complex schemas, consider using a library like zod-to-json-schema
 */
function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodSchema {
  const type = schema.type as string | undefined;
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  const required = schema.required as string[] | undefined;

  if (type === 'object' && properties) {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [key, propSchema] of Object.entries(properties)) {
      let zodType = jsonSchemaPropertyToZod(propSchema);

      // Mark as optional if not in required array
      if (!required?.includes(key)) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }

    return z.object(shape);
  }

  // Fallback to any
  return z.any();
}

/**
 * Convert a single JSON Schema property to Zod
 */
function jsonSchemaPropertyToZod(propSchema: Record<string, unknown>): z.ZodTypeAny {
  const type = propSchema.type as string | undefined;
  const description = propSchema.description as string | undefined;

  let zodType: z.ZodTypeAny;

  switch (type) {
    case 'string':
      zodType = z.string();
      break;
    case 'number':
      zodType = z.number();
      break;
    case 'integer':
      zodType = z.number().int();
      break;
    case 'boolean':
      zodType = z.boolean();
      break;
    case 'array': {
      const items = propSchema.items as Record<string, unknown> | undefined;
      const itemType = items ? jsonSchemaPropertyToZod(items) : z.any();
      zodType = z.array(itemType);
      break;
    }
    case 'object': {
      const nested = propSchema.properties as Record<string, Record<string, unknown>> | undefined;
      if (nested) {
        zodType = jsonSchemaToZod(propSchema);
      } else {
        zodType = z.record(z.string(), z.any());
      }
      break;
    }
    default:
      zodType = z.any();
  }

  if (description) {
    zodType = zodType.describe(description);
  }

  return zodType;
}
