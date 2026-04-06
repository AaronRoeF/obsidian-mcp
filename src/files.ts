import { obsidianExec, obsidianExecJSON, ok, err } from './cli.js';

const log = (...args: unknown[]) => console.error('[obsidian-files]', ...args);

export const fileTools = [
  {
    name: 'obsidian_read',
    description: 'Read the contents of a file in the vault. Resolves by name (like wikilinks) or exact path.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file: { type: 'string', description: 'File name (resolves like wikilinks)' },
        path: { type: 'string', description: 'Exact file path (e.g. "notes/meeting-notes.md")' },
      },
    },
  },
  {
    name: 'obsidian_file_info',
    description: 'Get metadata for a file: path, name, extension, size, created/modified timestamps.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file: { type: 'string', description: 'File name' },
        path: { type: 'string', description: 'Exact file path' },
      },
    },
  },
  {
    name: 'obsidian_outline',
    description: 'Get the heading structure of a file. Returns heading level, text, and line number.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file: { type: 'string', description: 'File name' },
        path: { type: 'string', description: 'Exact file path' },
      },
    },
  },
  {
    name: 'obsidian_create',
    description: 'Create a new file in the vault with optional content and template.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'File name (without .md extension)' },
        path: { type: 'string', description: 'Full path including folders (e.g. "projects/my-project/ref-notes.md")' },
        content: { type: 'string', description: 'Initial file content (markdown)' },
        template: { type: 'string', description: 'Template name to use (must be configured in Obsidian)' },
        overwrite: { type: 'boolean', description: 'Overwrite if file already exists (default false)' },
      },
    },
  },
  {
    name: 'obsidian_append',
    description: 'Append content to an existing file in the vault.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file: { type: 'string', description: 'File name' },
        path: { type: 'string', description: 'Exact file path' },
        content: { type: 'string', description: 'Content to append' },
      },
      required: ['content'],
    },
  },
  {
    name: 'obsidian_move',
    description: 'Move or rename a file. Automatically updates all wikilinks across the vault.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file: { type: 'string', description: 'File name to move' },
        path: { type: 'string', description: 'Exact file path to move' },
        to: { type: 'string', description: 'Destination folder or full path' },
      },
      required: ['to'],
    },
  },
  {
    name: 'obsidian_property_read',
    description: 'Read a specific YAML frontmatter property value from a file.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Property name to read' },
        file: { type: 'string', description: 'File name' },
        path: { type: 'string', description: 'Exact file path' },
      },
      required: ['name'],
    },
  },
  {
    name: 'obsidian_property_set',
    description: 'Set a YAML frontmatter property on a file. Creates the property if it doesn\'t exist.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Property name' },
        value: { type: 'string', description: 'Property value' },
        type: { type: 'string', description: 'Property type: text, list, number, checkbox, date, datetime' },
        file: { type: 'string', description: 'File name' },
        path: { type: 'string', description: 'Exact file path' },
      },
      required: ['name', 'value'],
    },
  },
  {
    name: 'obsidian_recents',
    description: 'List recently opened files in Obsidian.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'obsidian_vault_info',
    description: 'Get vault stats: name, path, file count, folder count, total size.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

export function handleFileTool(name: string, args: Record<string, unknown>): ReturnType<typeof ok> | null {
  try {
    switch (name) {
      case 'obsidian_read': return handleRead(args);
      case 'obsidian_file_info': return handleFileInfo(args);
      case 'obsidian_outline': return handleOutline(args);
      case 'obsidian_create': return handleCreate(args);
      case 'obsidian_append': return handleAppend(args);
      case 'obsidian_move': return handleMove(args);
      case 'obsidian_property_read': return handlePropertyRead(args);
      case 'obsidian_property_set': return handlePropertySet(args);
      case 'obsidian_recents': return handleRecents();
      case 'obsidian_vault_info': return handleVaultInfo();
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

function handleRead(args: Record<string, unknown>) {
  const fa = fileArg(args);
  if (!fa.file && !fa.path) return err('Provide either file (name) or path');
  return ok(obsidianExec('read', fa));
}

function handleFileInfo(args: Record<string, unknown>) {
  const fa = fileArg(args);
  if (!fa.file && !fa.path) return err('Provide either file (name) or path');

  const raw = obsidianExec('file', fa);
  // Parse TSV: path\tval\nname\tval\n...
  const info: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const [key, ...rest] = line.split('\t');
    if (key) info[key] = rest.join('\t');
  }
  // Convert epoch ms to ISO dates
  if (info.created) info.created = new Date(parseInt(info.created)).toISOString();
  if (info.modified) info.modified = new Date(parseInt(info.modified)).toISOString();
  return ok(info);
}

function handleOutline(args: Record<string, unknown>) {
  const fa = fileArg(args);
  if (!fa.file && !fa.path) return err('Provide either file (name) or path');
  return ok(obsidianExecJSON('outline', { ...fa, format: 'json' }));
}

function handleCreate(args: Record<string, unknown>) {
  const cliArgs: Record<string, string | number | boolean> = {};
  if (args.name) cliArgs.name = args.name as string;
  if (args.path) cliArgs.path = args.path as string;
  if (args.content) cliArgs.content = args.content as string;
  if (args.template) cliArgs.template = args.template as string;
  if (args.overwrite) cliArgs.overwrite = true;

  if (!cliArgs.name && !cliArgs.path) return err('Provide either name or path');

  const result = obsidianExec('create', cliArgs);
  return ok(result || 'File created');
}

function handleAppend(args: Record<string, unknown>) {
  const content = args.content as string;
  if (!content) return err('Missing required parameter: content');

  const fa = fileArg(args);
  if (!fa.file && !fa.path) return err('Provide either file (name) or path');

  const result = obsidianExec('append', { ...fa, content });
  return ok(result || 'Content appended');
}

function handleMove(args: Record<string, unknown>) {
  const to = args.to as string;
  if (!to) return err('Missing required parameter: to');

  const fa = fileArg(args);
  if (!fa.file && !fa.path) return err('Provide either file (name) or path');

  const result = obsidianExec('move', { ...fa, to });
  return ok(result || 'File moved');
}

function handlePropertyRead(args: Record<string, unknown>) {
  const propName = args.name as string;
  if (!propName) return err('Missing required parameter: name');

  const fa = fileArg(args);
  const result = obsidianExec('property:read', { ...fa, name: propName });
  return ok(result);
}

function handlePropertySet(args: Record<string, unknown>) {
  const propName = args.name as string;
  const propValue = args.value as string;
  if (!propName || !propValue) return err('Missing required parameters: name and value');

  const fa = fileArg(args);
  const cliArgs: Record<string, string | number | boolean> = { ...fa, name: propName, value: propValue };
  if (args.type) cliArgs.type = args.type as string;

  const result = obsidianExec('property:set', cliArgs);
  return ok(result || 'Property set');
}

function handleRecents() {
  const raw = obsidianExec('recents');
  return ok(raw.split('\n').filter(Boolean));
}

function handleVaultInfo() {
  const raw = obsidianExec('vault');
  const info: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const [key, ...rest] = line.split('\t');
    if (key) info[key] = rest.join('\t');
  }
  if (info.size) info.size_mb = (parseInt(info.size) / 1024 / 1024).toFixed(1);
  return ok(info);
}
