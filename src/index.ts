import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { searchTools, handleSearchTool } from './search.js';
import { fileTools, handleFileTool } from './files.js';
import { graphTools, handleGraphTool } from './graph.js';
import { dailyTools, handleDailyTool } from './daily.js';
import { baseTools, handleBaseTool } from './bases.js';

const log = (...args: unknown[]) => console.error('[obsidian-mcp]', ...args);

interface ToolModule {
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
  handle: (name: string, args: Record<string, unknown>) => {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  } | null;
}

const modules: ToolModule[] = [
  { tools: searchTools, handle: handleSearchTool },
  { tools: fileTools, handle: handleFileTool },
  { tools: graphTools, handle: handleGraphTool },
  { tools: dailyTools, handle: handleDailyTool },
  { tools: baseTools, handle: handleBaseTool },
];

const totalTools = modules.reduce((sum, m) => sum + m.tools.length, 0);

const server = new Server(
  { name: 'obsidian-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: modules.flatMap(m => m.tools),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const safeArgs = (args ?? {}) as Record<string, unknown>;

  for (const mod of modules) {
    const result = mod.handle(name, safeArgs);
    if (result !== null) {
      return result;
    }
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

async function main() {
  log('Starting server...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`Server ready — ${totalTools} tools registered (${searchTools.length} Search + ${fileTools.length} Files + ${graphTools.length} Graph + ${dailyTools.length} Daily + ${baseTools.length} Bases)`);
}

main().catch((error) => {
  log('Fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
