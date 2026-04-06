import { obsidianExec, obsidianExecJSON, ok, err } from './cli.js';

const log = (...args: unknown[]) => console.error('[obsidian-search]', ...args);

interface SearchMatch {
  line: number;
  text: string;
}

interface SearchResult {
  file: string;
  matches: SearchMatch[];
}

export const searchTools = [
  {
    name: 'obsidian_search',
    description: 'Search the Obsidian vault for text. Returns file paths and matching lines with context. Uses Obsidian\'s search index (faster than filesystem grep, respects .obsidian ignore rules).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query text' },
        path: { type: 'string', description: 'Limit search to a folder path (e.g. "projects/research")' },
        limit: { type: 'number', description: 'Max files to return (default 20)' },
        case_sensitive: { type: 'boolean', description: 'Case sensitive search (default false)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'obsidian_tags',
    description: 'List tags in the vault with occurrence counts. Optionally filter to a specific file.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file: { type: 'string', description: 'File name to get tags for (optional — omit for vault-wide)' },
        sort_by_count: { type: 'boolean', description: 'Sort by count instead of name (default true)' },
      },
    },
  },
  {
    name: 'obsidian_properties',
    description: 'List YAML frontmatter properties across the vault with types and occurrence counts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file: { type: 'string', description: 'File name to get properties for (optional — omit for vault-wide)' },
        name: { type: 'string', description: 'Get count for a specific property name' },
      },
    },
  },
];

export function handleSearchTool(name: string, args: Record<string, unknown>): ReturnType<typeof ok> | null {
  try {
    switch (name) {
      case 'obsidian_search':
        return handleSearch(args);
      case 'obsidian_tags':
        return handleTags(args);
      case 'obsidian_properties':
        return handleProperties(args);
      default:
        return null;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log('Error:', message);
    return err(message);
  }
}

function handleSearch(args: Record<string, unknown>) {
  const query = args.query as string;
  if (!query) return err('Missing required parameter: query');

  const cliArgs: Record<string, string | number | boolean> = {
    query,
  };
  if (args.path) cliArgs.path = args.path as string;
  if (args.limit) cliArgs.limit = args.limit as number;
  if (args.case_sensitive) cliArgs.case = true;

  // Try search:context with JSON first (works for single-word queries)
  // Fall back to text format + parse for multi-word queries (CLI bug: JSON + spaces = empty)
  try {
    const raw = obsidianExec('search:context', { ...cliArgs, format: 'json' });
    if (raw) {
      const results: SearchResult[] = JSON.parse(raw);
      if (results.length > 0) {
        return ok({ results, total: results.length });
      }
    }
  } catch {
    // JSON parse failed — fall through to text parsing
  }

  // Fallback: parse text format (file:line: text)
  const textRaw = obsidianExec('search:context', { ...cliArgs, format: 'text' });
  if (!textRaw) return ok({ results: [], total: 0 });

  const results: SearchResult[] = [];
  const fileMap = new Map<string, SearchMatch[]>();

  for (const line of textRaw.split('\n')) {
    // Format: "path/file.md:42: matching text here"
    const match = line.match(/^(.+?\.md):(\d+):\s*(.+)$/);
    if (match) {
      const [, file, lineNum, text] = match;
      if (!fileMap.has(file)) fileMap.set(file, []);
      fileMap.get(file)!.push({ line: parseInt(lineNum), text: text.trim() });
    }
  }

  for (const [file, matches] of fileMap) {
    results.push({ file, matches });
  }

  return ok({ results, total: results.length });
}

function handleTags(args: Record<string, unknown>) {
  const cliArgs: Record<string, string | number | boolean> = {
    counts: true,
    sort: (args.sort_by_count !== false) ? 'count' : 'name',
    format: 'json',
  };
  if (args.file) cliArgs.file = args.file as string;

  return ok(obsidianExecJSON('tags', cliArgs));
}

function handleProperties(args: Record<string, unknown>) {
  const cliArgs: Record<string, string | number | boolean> = {
    counts: true,
    sort: 'count',
    format: 'json',
  };
  if (args.file) cliArgs.file = args.file as string;
  if (args.name) cliArgs.name = args.name as string;

  return ok(obsidianExecJSON('properties', cliArgs));
}
