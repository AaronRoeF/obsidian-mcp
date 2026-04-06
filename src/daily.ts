import { obsidianExec, ok, err } from './cli.js';

const log = (...args: unknown[]) => console.error('[obsidian-daily]', ...args);

export const dailyTools = [
  {
    name: 'obsidian_daily_read',
    description: 'Read today\'s daily note contents. Returns empty if no daily note exists yet.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'obsidian_daily_append',
    description: 'Append content to today\'s daily note. Creates the daily note if it doesn\'t exist.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'Content to append to the daily note' },
      },
      required: ['content'],
    },
  },
  {
    name: 'obsidian_daily_prepend',
    description: 'Prepend content to today\'s daily note. Creates the daily note if it doesn\'t exist.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'Content to prepend to the daily note' },
      },
      required: ['content'],
    },
  },
  {
    name: 'obsidian_daily_path',
    description: 'Get the file path of today\'s daily note.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

export function handleDailyTool(name: string, args: Record<string, unknown>): ReturnType<typeof ok> | null {
  try {
    switch (name) {
      case 'obsidian_daily_read': return handleDailyRead();
      case 'obsidian_daily_append': return handleDailyAppend(args);
      case 'obsidian_daily_prepend': return handleDailyPrepend(args);
      case 'obsidian_daily_path': return handleDailyPath();
      default: return null;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log('Error:', message);
    return err(message);
  }
}

function handleDailyRead() {
  const content = obsidianExec('daily:read');
  return ok(content || '(No daily note for today)');
}

function handleDailyAppend(args: Record<string, unknown>) {
  const content = args.content as string;
  if (!content) return err('Missing required parameter: content');
  const result = obsidianExec('daily:append', { content });
  return ok(result || 'Appended to daily note');
}

function handleDailyPrepend(args: Record<string, unknown>) {
  const content = args.content as string;
  if (!content) return err('Missing required parameter: content');
  const result = obsidianExec('daily:prepend', { content });
  return ok(result || 'Prepended to daily note');
}

function handleDailyPath() {
  return ok(obsidianExec('daily:path'));
}
