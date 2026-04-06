#!/usr/bin/env node

// All logging goes to stderr — stdout is reserved for MCP protocol
const log = (...args) => console.error(...args);

// Support --vault flag as alternative to env var
const vaultArg = process.argv.find(a => a.startsWith('--vault'));
if (vaultArg) {
  const vaultName = vaultArg.includes('=') ? vaultArg.split('=')[1] : process.argv[process.argv.indexOf(vaultArg) + 1];
  if (vaultName) process.env.OBSIDIAN_VAULT_NAME = vaultName;
}

if (!process.env.OBSIDIAN_VAULT_NAME) {
  log('[obsidian-mcp] Error: No vault specified. Use --vault=<name> or set OBSIDIAN_VAULT_NAME env var.');
  log('[obsidian-mcp] List vaults with: obsidian vaults');
  process.exit(1);
}

log(`[obsidian-mcp] Starting (vault: ${process.env.OBSIDIAN_VAULT_NAME})...`);

import('./dist/index.js').catch((error) => {
  log('[obsidian-mcp] Fatal:', error.message);
  process.exit(1);
});
