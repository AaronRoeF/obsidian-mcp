import { obsidianExec, obsidianExecJSON, ok, err } from './cli.js';

const log = (...args: unknown[]) => console.error('[obsidian-bases]', ...args);

export const baseTools = [
  {
    name: 'obsidian_bases_list',
    description: 'List all Obsidian Base files in the vault. Bases are database-like views over vault files, configured in the Obsidian UI.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'obsidian_base_views',
    description: 'List views (table, board, etc.) in a specific Base file. The base must be the active file in Obsidian.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file: { type: 'string', description: 'Base file name (e.g. "People.base")' },
      },
    },
  },
  {
    name: 'obsidian_base_query',
    description: 'Query a Base and return structured results. Returns rows with frontmatter properties as columns. The base must be the active file in Obsidian.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file: { type: 'string', description: 'Base file name (e.g. "People.base")' },
        view: { type: 'string', description: 'View name to query (default: first view)' },
        format: { type: 'string', description: 'Output format: json, csv, tsv, md, paths (default: json)' },
      },
    },
  },
  {
    name: 'obsidian_base_create_item',
    description: 'Create a new item (file) in a Base. The base must be the active file in Obsidian.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file: { type: 'string', description: 'Base file name (e.g. "People.base")' },
        view: { type: 'string', description: 'View name' },
        name: { type: 'string', description: 'Name for the new file' },
        content: { type: 'string', description: 'Initial content for the new file' },
      },
      required: ['name'],
    },
  },
];

export function handleBaseTool(name: string, args: Record<string, unknown>): ReturnType<typeof ok> | null {
  try {
    switch (name) {
      case 'obsidian_bases_list': return handleBasesList();
      case 'obsidian_base_views': return handleBaseViews(args);
      case 'obsidian_base_query': return handleBaseQuery(args);
      case 'obsidian_base_create_item': return handleBaseCreateItem(args);
      default: return null;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log('Error:', message);
    return err(message);
  }
}

function openBaseIfNeeded(file: string | undefined) {
  if (file) {
    obsidianExec('open', { file });
  }
}

function handleBasesList() {
  const raw = obsidianExec('bases');
  if (!raw || raw.includes('No base files')) return ok([]);
  return ok(raw.split('\n').filter(Boolean));
}

function handleBaseViews(args: Record<string, unknown>) {
  openBaseIfNeeded(args.file as string);
  const raw = obsidianExec('base:views');
  if (!raw) return ok([]);
  // Format: "ViewName\tviewtype" per line
  const views = raw.split('\n').filter(Boolean).map(line => {
    const [name, type] = line.split('\t');
    return { name, type };
  });
  return ok(views);
}

function handleBaseQuery(args: Record<string, unknown>) {
  openBaseIfNeeded(args.file as string);
  const cliArgs: Record<string, string | number | boolean> = {
    format: (args.format as string) || 'json',
  };
  if (args.view) cliArgs.view = args.view as string;

  if (cliArgs.format === 'json') {
    return ok(obsidianExecJSON('base:query', cliArgs));
  }
  return ok(obsidianExec('base:query', cliArgs));
}

function handleBaseCreateItem(args: Record<string, unknown>) {
  const name = args.name as string;
  if (!name) return err('Missing required parameter: name');

  openBaseIfNeeded(args.file as string);
  const cliArgs: Record<string, string | number | boolean> = { name };
  if (args.view) cliArgs.view = args.view as string;
  if (args.content) cliArgs.content = args.content as string;

  const result = obsidianExec('base:create', cliArgs);
  return ok(result || `Created item: ${name}`);
}
