# obsidian-mcp

MCP server that connects Claude Code (or any MCP client) to your Obsidian vault. Search, read, create, and navigate your vault as a knowledge graph.

Requires [Obsidian](https://obsidian.md) with CLI enabled (Settings > General > CLI).

## Install

```bash
# With Claude Code
claude mcp add obsidian -- npx obsidian-mcp --vault "My Vault"

# Or in ~/.claude.json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["obsidian-mcp", "--vault", "My Vault"],
      "env": {}
    }
  }
}
```

Find your vault name with `obsidian vaults` in Terminal.

## Tools (26)

### Search (3)
| Tool | Description |
|------|-------------|
| `obsidian_search` | Full-text search with line context |
| `obsidian_tags` | List tags with occurrence counts |
| `obsidian_properties` | List YAML frontmatter properties |

### Files (10)
| Tool | Description |
|------|-------------|
| `obsidian_read` | Read file by name or path |
| `obsidian_file_info` | File metadata (size, created, modified) |
| `obsidian_outline` | Heading structure of a file |
| `obsidian_create` | Create a new file (with optional template) |
| `obsidian_append` | Append content to a file |
| `obsidian_move` | Move/rename (auto-updates all wikilinks) |
| `obsidian_property_read` | Read a frontmatter property |
| `obsidian_property_set` | Set a frontmatter property |
| `obsidian_recents` | Recently opened files |
| `obsidian_vault_info` | Vault stats (files, folders, size) |

### Graph (5)
| Tool | Description |
|------|-------------|
| `obsidian_backlinks` | Files linking TO a file |
| `obsidian_links` | Outgoing links FROM a file |
| `obsidian_orphans` | Files with no incoming links |
| `obsidian_unresolved` | Broken wikilinks |
| `obsidian_tasks` | Checkbox tasks across the vault |

### Daily Notes (4)
| Tool | Description |
|------|-------------|
| `obsidian_daily_read` | Read today's daily note |
| `obsidian_daily_append` | Append to daily note |
| `obsidian_daily_prepend` | Prepend to daily note |
| `obsidian_daily_path` | Get daily note path |

### Bases (4)
| Tool | Description |
|------|-------------|
| `obsidian_bases_list` | List Base files in vault |
| `obsidian_base_views` | List views in a Base |
| `obsidian_base_query` | Query a Base (structured results) |
| `obsidian_base_create_item` | Create item in a Base |

## Requirements

- **Obsidian** must be running (CLI communicates with the app)
- **CLI enabled** in Obsidian Settings > General
- **Node.js** >= 18

## Configuration

The vault is specified via `--vault` flag or `OBSIDIAN_VAULT_NAME` environment variable.

```bash
# Flag
npx obsidian-mcp --vault="My Vault"

# Environment variable
OBSIDIAN_VAULT_NAME="My Vault" npx obsidian-mcp
```

## Known Issues

- `search:context` with `format=json` returns empty for multi-word queries (Obsidian CLI bug in 1.12.x). The server automatically falls back to text parsing.
- Obsidian CLI prints loader messages to stdout. The server strips these automatically.

## License

MIT
