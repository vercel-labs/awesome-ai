# Awesome AI CLI

Add agents, tools, and prompts from registries to your project.

## Installation

```bash
pnpm add -D cli
```

Or run directly with npx:

```bash
npx awesome-ai <command>
```

## Quick Start

```bash
# Initialize your project
npx awesome-ai init

# Add an agent
npx awesome-ai add coding-agent --type agents

# Add a tool
npx awesome-ai add bash --type tools
```

## Commands

### `init`

Initialize your project and create an `agents.json` configuration file.

```bash
npx awesome-ai init [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-y, --yes` | Skip confirmation prompt | `true` |
| `-d, --defaults` | Use default configuration | `false` |
| `-f, --force` | Force overwrite of existing configuration | `false` |
| `-c, --cwd <path>` | Working directory | Current directory |
| `-s, --silent` | Mute output | `false` |

**Examples:**

```bash
# Interactive initialization
npx awesome-ai init

# Non-interactive with defaults
npx awesome-ai init --defaults

# Initialize in a specific directory
npx awesome-ai init --cwd ./my-project

# Force overwrite existing config
npx awesome-ai init --force
```

---

### `add`

Add an agent, tool, or prompt to your project.

```bash
npx awesome-ai add <items...> --type <type> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `items` | Names of items to add (space-separated) |

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --type <type>` | Type of item: `agents`, `tools`, or `prompts` | Required |
| `-y, --yes` | Skip confirmation prompt | `false` |
| `-o, --overwrite` | Overwrite existing files | `false` |
| `-c, --cwd <path>` | Working directory | Current directory |
| `-s, --silent` | Mute output | `false` |

**Examples:**

```bash
# Add a single agent
npx awesome-ai add coding-agent --type agents

# Add multiple tools
npx awesome-ai add bash python javascript --type tools

# Add with overwrite
npx awesome-ai add coding-agent --type agents --overwrite

# Add to a specific directory
npx awesome-ai add coding-agent --type agents --cwd ./my-project
```

---

### `list`

List available items from registries.

```bash
npx awesome-ai list [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --type <type>` | Type to list: `agents`, `tools`, or `prompts` | `agents` |
| `-c, --cwd <path>` | Working directory | Current directory |

**Examples:**

```bash
# List all agents
npx awesome-ai list

# List all tools
npx awesome-ai list --type tools

# List all prompts
npx awesome-ai list --type prompts
```

---

### `search`

Search items from registries by name or description.

```bash
npx awesome-ai search [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-q, --query <query>` | Search query string | - |
| `-t, --type <type>` | Type to search: `agents`, `tools`, or `prompts` | `agents` |
| `-c, --cwd <path>` | Working directory | Current directory |

**Examples:**

```bash
# Search for agents with "coding" in name or description
npx awesome-ai search --query coding

# Search for tools
npx awesome-ai search --query bash --type tools
```

---

### `view`

View detailed information about specific items from the registry.

```bash
npx awesome-ai view <items...> --type <type> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `items` | Names of items to view (space-separated) |

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --type <type>` | Type of item: `agents`, `tools`, or `prompts` | Required |
| `-c, --cwd <path>` | Working directory | Current directory |

**Examples:**

```bash
# View an agent's details
npx awesome-ai view coding-agent --type agents

# View multiple tools
npx awesome-ai view bash python --type tools
```

---

### `diff`

Check for updates by comparing local files against the registry.

```bash
npx awesome-ai diff <item> --type <type> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `item` | Name of the item to diff |

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --type <type>` | Type of item: `agents`, `tools`, or `prompts` | Required |
| `-c, --cwd <path>` | Working directory | Current directory |

**Examples:**

```bash
# Check if an agent has updates
npx awesome-ai diff coding-agent --type agents

# Check a tool for updates
npx awesome-ai diff bash --type tools
```

---

## Configuration

The CLI uses an `agents.json` file for configuration. This file is created when you run `init`.

### Example `agents.json`

```json
{
  "$schema": "https://awesome-ai.com/schema.json",
  "tsx": true,
  "aliases": {
    "agents": "@/agents",
    "tools": "@/tools",
    "prompts": "@/prompts"
  }
}
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `$schema` | `string` | JSON schema URL for validation |
| `tsx` | `boolean` | Whether the project uses TypeScript |
| `aliases.agents` | `string` | Import alias for agents directory |
| `aliases.tools` | `string` | Import alias for tools directory |
| `aliases.prompts` | `string` | Import alias for prompts directory |
| `registries` | `object` | Custom registry configurations |

### Custom Registries

You can add custom registries to your `agents.json`:

```json
{
  "tsx": true,
  "aliases": {
    "agents": "@/agents",
    "tools": "@/tools",
    "prompts": "@/prompts"
  },
  "registries": {
    "@my-registry": "https://my-registry.com/{type}/{name}.json",
    "@private": {
      "url": "https://private-registry.com/{type}/{name}.json",
      "headers": {
        "Authorization": "Bearer ${MY_AUTH_TOKEN}"
      }
    }
  }
}
```

Registry URLs must include `{type}` and `{name}` placeholders.

---

## Environment Variables

### `REGISTRY_URL`

Override the default registry URL:

```bash
REGISTRY_URL=https://my-registry.com npx awesome-ai list
```

### Authentication

For private registries, use environment variables in headers:

```json
{
  "registries": {
    "@private": {
      "url": "https://api.example.com/{type}/{name}.json",
      "headers": {
        "Authorization": "Bearer ${AUTH_TOKEN}"
      }
    }
  }
}
```

The CLI will load environment variables from `.env` files in your project.

---

## Registry Item Schema

Items in the registry follow this schema:

```typescript
{
  name: string           // Item name (required)
  type: string           // "registry:agent" | "registry:tool" | "registry:prompt"
  title?: string         // Display title
  author?: string        // Author name
  description?: string   // Description
  dependencies?: string[]      // npm dependencies
  devDependencies?: string[]   // npm dev dependencies
  registryDependencies?: string[]  // Other registry items this depends on
  files?: {
    path: string         // File path
    content?: string     // File content
    type: string         // File type
    target?: string      // Target path override
  }[]
  meta?: Record<string, any>   // Additional metadata
  docs?: string          // Documentation URL
  categories?: string[]  // Categories for organization
}
```

---

## Features

- **Automatic Dependency Resolution**: When adding an agent, the CLI automatically downloads any tools and prompts it depends on
- **Import Transformation**: Automatically transforms imports to use your configured path aliases
- **Package Manager Detection**: Detects your package manager (npm, pnpm, yarn, bun, deno) and installs npm dependencies automatically
- **TypeScript Support**: Full TypeScript support with automatic detection
- **File Conflict Handling**: Prompts for confirmation before overwriting existing files, with diff preview
- **Custom Registries**: Support for multiple registries with authentication

---

## Examples

### Setting Up a New Project

```bash
# Create a new project
mkdir my-ai-project && cd my-ai-project
npm init -y

# Initialize the CLI
npx awesome-ai init

# Add an agent with its dependencies
npx awesome-ai add coding-agent --type agents
```

### Working with Multiple Items

```bash
# Add multiple tools at once
npx awesome-ai add bash python javascript --type tools

# List and search
npx awesome-ai list --type tools
npx awesome-ai search --query "code" --type agents
```

### Checking for Updates

```bash
# See what changed in an agent
npx awesome-ai diff coding-agent --type agents

# Update by overwriting
npx awesome-ai add coding-agent --type agents --overwrite
```

---

## License

MIT

