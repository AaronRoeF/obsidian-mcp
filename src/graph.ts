import { obsidianExec, obsidianExecJSON, ok, err } from './cli.js';

const log = (...args: unknown[]) => console.error('[obsidian-graph]', ...args);

export const graphTools = [
  {
    name: 'obsidian_backlinks',
    description: 'List files that link TO a specific file (incoming links). Shows the graph neighborhood.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file: { type: 'string', description: 'File name to find backlinks for' },
        path: { type: 'string', description: 'Exact file path' },
      },
    },
  },
  {
    name: 'obsidian_links',
    description: 'List outgoing links FROM a specific file (what it links to).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file: { type: 'string', description: 'File name' },
        path: { type: 'string', description: 'Exact file path' },
      },
    },
  },
  {
    name: 'obsidian_orphans',
    description: 'List files with no incoming links (orphans). Useful for finding disconnected notes.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        total_only: { type: 'boolean', description: 'Return just the count (default false)' },
      },
    },
  },
  {
    name: 'obsidian_unresolved',
    description: 'List broken/unresolved links in the vault — wikilinks pointing to files that don\'t exist.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        total_only: { type: 'boolean', description: 'Return just the count (default false)' },
        verbose: { type: 'boolean', description: 'Include source files for each unresolved link' },
      },
    },
  },
  {
    name: 'obsidian_tasks',
    description: 'List tasks (checkboxes) in the vault. Filter by file, status (todo/done), or get totals.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file: { type: 'string', description: 'Filter tasks by file name' },
        path: { type: 'string', description: 'Filter tasks by file path' },
        status: { type: 'string', description: '"todo" for incomplete, "done" for completed' },
        total_only: { type: 'boolean', description: 'Return just the count (default false)' },
        verbose: { type: 'boolean', description: 'Group by file with line numbers' },
      },
    },
  },
];

export function handleGraphTool(name: string, args: Record<string, unknown>): ReturnType<typeof ok> | null {
  try {
    switch (name) {
      case 'obsidian_backlinks': return handleBacklinks(args);
      case 'obsidian_links': return handleLinks(args);
      case 'obsidian_orphans': return handleOrphans(args);
      case 'obsidian_unresolved': return handleUnresolved(args);
      case 'obsidian_tasks': return handleTasks(args);
      default: return null;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log('Error:', message);
    return err(message);
  }
}

function fileArg(args: Record<string, unknown>): Record<string, string> {
  if (args.path) return { path: args.path as string };
  if (args.file) return { file: args.file as string };
  return {};
}

function handleBacklinks(args: Record<string, unknown>) {
  const fa = fileArg(args);
  if (!fa.file && !fa.path) return err('Provide either file (name) or path');
  return ok(obsidianExecJSON('backlinks', { ...fa, format: 'json' }));
}

function handleLinks(args: Record<string, unknown>) {
  const fa = fileArg(args);
  if (!fa.file && !fa.path) return err('Provide either file (name) or path');

  const raw = obsidianExec('links', fa);
  if (!raw || raw === 'No links found.') return ok([]);
  return ok(raw.split('\n').filter(Boolean));
}

function handleOrphans(args: Record<string, unknown>) {
  if (args.total_only) {
    return ok({ total: parseInt(obsidianExec('orphans', { total: true })) });
  }
  const raw = obsidianExec('orphans');
  return ok(raw.split('\n').filter(Boolean));
}

function handleUnresolved(args: Record<string, unknown>) {
  const cliArgs: Record<string, string | number | boolean> = {};
  if (args.total_only) cliArgs.total = true;
  if (args.verbose) cliArgs.verbose = true;
  if (!args.total_only) cliArgs.format = 'json';

  if (args.total_only) {
    return ok({ total: parseInt(obsidianExec('unresolved', cliArgs)) });
  }
  return ok(obsidianExecJSON('unresolved', cliArgs));
}

function handleTasks(args: Record<string, unknown>) {
  const cliArgs: Record<string, string | number | boolean> = {};
  if (args.file) cliArgs.file = args.file as string;
  if (args.path) cliArgs.path = args.path as string;
  if (args.status === 'todo') cliArgs.todo = true;
  if (args.status === 'done') cliArgs.done = true;
  if (args.total_only) cliArgs.total = true;
  if (args.verbose) cliArgs.verbose = true;

  if (args.total_only) {
    return ok({ total: parseInt(obsidianExec('tasks', cliArgs)) });
  }

  cliArgs.format = 'json';
  return ok(obsidianExecJSON('tasks', cliArgs));
}
