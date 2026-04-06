import { execSync } from 'child_process';

const log = (...args: unknown[]) => console.error('[obsidian-mcp]', ...args);

/**
 * Execute an Obsidian CLI command and return stdout only.
 * Strips stderr noise (loader messages, update warnings).
 * Throws on non-zero exit or if Obsidian is not running.
 */
export function obsidianExec(command: string, args: Record<string, string | number | boolean> = {}): string {
  const vault = process.env.OBSIDIAN_VAULT_NAME;
  if (!vault) {
    throw new Error('OBSIDIAN_VAULT_NAME environment variable is not set');
  }

  // Build arg string: key=value pairs, booleans as flags
  const argParts: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (value === true) {
      argParts.push(key);
    } else if (value !== false && value !== undefined && value !== '') {
      // Quote string values that contain spaces
      const strVal = String(value);
      if (strVal.includes(' ') || strVal.includes('\n')) {
        argParts.push(`${key}="${strVal}"`);
      } else {
        argParts.push(`${key}=${strVal}`);
      }
    }
  }

  const fullCmd = `obsidian ${command} vault=${vault} ${argParts.join(' ')}`.trim();
  log('exec:', fullCmd);

  try {
    const stdout = execSync(fullCmd, {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'], // capture stderr separately
    });
    // Strip Obsidian's loader noise that leaks into stdout
    // Lines like "2026-04-06 03:02:39 Loading updated app package..." and "Your Obsidian installer is out of date..."
    const cleaned = stdout
      .split('\n')
      .filter(line => !line.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} Loading/) && !line.startsWith('Your Obsidian installer'))
      .join('\n')
      .trim();
    return cleaned;
  } catch (error: unknown) {
    const execError = error as { stderr?: string; status?: number; message?: string };

    // Check if Obsidian is running
    if (execError.stderr?.includes('Could not connect') || execError.stderr?.includes('ECONNREFUSED')) {
      throw new Error('Obsidian is not running. Please open Obsidian and try again.');
    }

    // Check if CLI is not in PATH
    if (execError.message?.includes('ENOENT') || execError.message?.includes('not found')) {
      throw new Error('Obsidian CLI not found in PATH. Enable it in Obsidian Settings > General.');
    }

    throw new Error(`CLI error: ${execError.stderr || execError.message || 'Unknown error'}`);
  }
}

/**
 * Execute and parse JSON output from the CLI.
 */
export function obsidianExecJSON<T = unknown>(command: string, args: Record<string, string | number | boolean> = {}): T {
  const raw = obsidianExec(command, { ...args, format: 'json' });
  if (!raw) return [] as unknown as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Failed to parse JSON from CLI output: ${raw.slice(0, 200)}`);
  }
}

/** Standard MCP success response */
export function ok(data: unknown) {
  return {
    content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
  };
}

/** Standard MCP error response */
export function err(message: string) {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}
