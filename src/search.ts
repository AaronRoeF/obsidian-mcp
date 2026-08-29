import { obsidianExec, obsidianExecJSON, ok, err } from './cli.js';
import { execSync } from 'child_process';
import { readFileSync, realpathSync } from 'fs';
import { join } from 'path';

const log = (...args: unknown[]) => console.error('[obsidian-search]', ...args);

// ---------------------------------------------------------------------------
// Filesystem fallback. The Obsidian CLI's search commands silently return
// nothing on out-of-date installers (the app hot-updates its asar; the CLI in
// the installer binary does not). An empty CLI result is therefore
// indistinguishable from "no matches" — so any empty result falls through to
// a grep over the vault, which honors .obsidian/app.json userIgnoreFilters.
// The response carries source: 'filesystem-fallback' so a consumer can tell.
// ---------------------------------------------------------------------------

let cachedVaultPath: string | null = null;

function vaultPath(): string {
  if (cachedVaultPath) return cachedVaultPath;
  if (process.env.OBSIDIAN_VAULT_PATH) {          // config-provided: no CLI dependency
    cachedVaultPath = process.env.OBSIDIAN_VAULT_PATH;
    return cachedVaultPath;
  }
  // vault:info works even when search is broken, but rapid sequential CLI calls
  // against the app socket can flake to empty — try twice before giving up.
  for (let attempt = 0; attempt < 2; attempt++) {
    const info = obsidianExec('vault:info', {});
    const m = info.match(/^path\t(.+)$/m);
    if (m) { cachedVaultPath = m[1].trim(); return cachedVaultPath; }
  }
  throw new Error('vault:info returned no path — set OBSIDIAN_VAULT_PATH to enable the filesystem fallback');
}

function ignorePrefixes(root: string): string[] {
  try {
    const app = JSON.parse(readFileSync(join(root, '.obsidian', 'app.json'), 'utf-8'));
    return Array.isArray(app.userIgnoreFilters) ? app.userIgnoreFilters : [];
  } catch {
    return [];
  }
}

function fsFallbackSearch(query: string, opts: { path?: string; limit: number; caseSensitive: boolean }): SearchResult[] {
  // The vault path is often a symlink (~/Exo -> iCloud); grep won't descend
  // through a symlink given as the start path, so resolve it first.
  const root = realpathSync(vaultPath());
  const searchRoot = opts.path ? join(root, opts.path) : root;
  const flag = opts.caseSensitive ? '' : '-i';
  let raw = '';
  try {
    raw = execSync(
      `grep -rn ${flag} -F --include='*.md' ` +
      `--exclude-dir='.git' --exclude-dir='.git.nosync' --exclude-dir='.obsidian' ` +
      `--exclude-dir='.trash' --exclude-dir='node_modules' ` +
      `-e ${JSON.stringify(query)} ${JSON.stringify(searchRoot)}`,
      { encoding: 'utf-8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 },
    );
  } catch (e: unknown) {
    const g = e as { status?: number; stdout?: string };
    if (g.status === 1) raw = g.stdout ?? '';   // grep exit 1 = no matches
    else throw e;
  }
  const ignored = ignorePrefixes(root);
  const fileMap = new Map<string, SearchMatch[]>();
  for (const line of raw.split('\n')) {
    const m = line.match(/^(.+?\.md):(\d+):(.*)$/);
    if (!m) continue;
    const rel = m[1].startsWith(root + '/') ? m[1].slice(root.length + 1) : m[1];
    if (ignored.some(p => rel.startsWith(p))) continue;   // Obsidian Excluded Files
    if (!fileMap.has(rel)) {
      if (fileMap.size >= opts.limit) continue;
      fileMap.set(rel, []);
    }
    fileMap.get(rel)!.push({ line: parseInt(m[2]), text: m[3].trim() });
  }
  return [...fileMap.entries()].map(([file, matches]) => ({ file, matches }));
}

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

  const results: SearchResult[] = [];
  if (textRaw) {
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
  }
  if (results.length > 0) return ok({ results, total: results.length });

  // Both CLI attempts empty — on a stale installer that means nothing. Grep is truth.
  const fbResults = fsFallbackSearch(query, {
    path: args.path as string | undefined,
    limit: (args.limit as number) || 20,
    caseSensitive: !!args.case_sensitive,
  });
  return ok({ results: fbResults, total: fbResults.length, source: 'filesystem-fallback' });
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
