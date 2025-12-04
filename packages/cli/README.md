# Awesome AI CLI

Add agents, tools, and prompts from registries to your project.

## Prerequisites

The CLI requires [Bun](https://bun.sh) to be installed.

```bash
# Install Bun (macOS, Linux, WSL)
curl -fsSL https://bun.sh/install | bash
```

For other installation methods, see the [Bun installation docs](https://bun.sh/docs/installation).

## Installation

Install globally (recommended):

```bash
pnpm add -g awesome-ai
```

Any package manager works (npm, yarn, bun):

```bash
npm install -g awesome-ai
yarn global add awesome-ai
bun add -g awesome-ai
```

Installing it locally is also possible:

```bash
pnpm add -D awesome-ai
```

## Quick Start

**Try instantly:**

```bash
# Run an agent directly from the remote registry
awesome-ai run coding-agent --remote
```

**Or set up a local project:**

```bash
# Initialize your project
awesome-ai init

# Add an agent
awesome-ai add coding-agent

# Add a tool
awesome-ai add bash --tool

# Add a prompt
awesome-ai add coding-agent --prompt

# Run an agent interactively
awesome-ai run coding-agent
```

---

## Commands

### `init`

Initialize your project and create an `agents.json` configuration file.

```bash
awesome-ai init [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-y, --yes` | Skip confirmation prompt | `true` |
| `-d, --defaults` | Use default configuration | `false` |
| `-c, --cwd <path>` | Working directory | Current directory |
| `-s, --silent` | Mute output | `false` |

**Examples:**

```bash
# Interactive initialization
awesome-ai init

# Non-interactive with defaults
awesome-ai init --defaults

# Initialize in a specific directory
awesome-ai init --cwd ./my-project
```

---

### `add`

Add an agent, tool, or prompt to your project.

```bash
awesome-ai add <items...> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `items` | Names of items to add (space-separated) |

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--tool` | Add a tool instead of an agent | `false` |
| `--prompt` | Add a prompt instead of an agent | `false` |
| `-y, --yes` | Skip confirmation prompt | `false` |
| `-o, --overwrite` | Overwrite existing files | `false` |
| `-c, --cwd <path>` | Working directory | Current directory |
| `-s, --silent` | Mute output | `false` |

> **Note:** By default, items are added as agents. Use `--tool` or `--prompt` to add other types.

**Examples:**

```bash
# Add a single agent (default type)
awesome-ai add coding-agent

# Add multiple agents
awesome-ai add coding-agent research-agent planning-agent

# Add a tool
awesome-ai add bash --tool

# Add multiple tools
awesome-ai add bash edit write grep --tool

# Add a prompt
awesome-ai add coding-agent --prompt

# Add with overwrite
awesome-ai add coding-agent --overwrite

# Add to a specific directory
awesome-ai add coding-agent --cwd ./my-project
```

---

### `list`

List available items from registries.

```bash
awesome-ai list [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --type <type>` | Type to list: `agents`, `tools`, or `prompts` | `agents` |
| `-r, --registry <registry>` | Registry to list from | `@awesome-ai` |
| `-c, --cwd <path>` | Working directory | Current directory |

**Examples:**

```bash
# List all agents
awesome-ai list

# List all tools
awesome-ai list --type tools

# List all prompts
awesome-ai list --type prompts

# List from a custom registry
awesome-ai list --registry @my-registry
```

---

### `search`

Search items from registries by name or description.

```bash
awesome-ai search [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-q, --query <query>` | Search query string | - |
| `-t, --type <type>` | Type to search: `agents`, `tools`, or `prompts` | `agents` |
| `-r, --registry <registry>` | Registry to search from | `@awesome-ai` |
| `-c, --cwd <path>` | Working directory | Current directory |

**Examples:**

```bash
# Search for agents with "coding" in name or description
awesome-ai search --query coding

# Search for tools
awesome-ai search --query bash --type tools

# Search a custom registry
awesome-ai search --query planning --registry @my-registry
```

---

### `view`

View detailed information about specific items from the registry.

```bash
awesome-ai view <items...> [options]
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
awesome-ai view coding-agent --type agents

# View multiple tools
awesome-ai view bash edit --type tools

# View a prompt
awesome-ai view coding-agent --type prompts
```

---

### `diff`

Check for updates by comparing local files against the registry.

```bash
awesome-ai diff <item> [options]
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
awesome-ai diff coding-agent --type agents

# Check a tool for updates
awesome-ai diff bash --type tools

# Check a prompt for updates
awesome-ai diff coding-agent --type prompts
```

---

### `run`

Start an interactive TUI (Terminal User Interface) chat session with an agent.

```bash
awesome-ai run [agent] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `agent` | Name of the agent to run (optional for local, required for remote) |

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --cwd <path>` | Working directory | Current directory |
| `-r, --remote` | Use agents from the remote registry (downloads if missing) | `false` |
| `--remote-only` | Use only remote agents (ignore local `agents.json`) | `false` |
| `-y, --yes` | Skip confirmation prompt for remote sync | `false` |

> **Note:** Without `--remote` or `--remote-only`, requires an initialized project with `agents.json` configuration.

**Examples:**

```bash
# List available local agents
awesome-ai run

# Run a specific local agent
awesome-ai run coding-agent

# Run an agent from the remote registry (downloads if not cached)
awesome-ai run coding-agent --remote

# Run using only remote agents (no local agents.json needed)
awesome-ai run coding-agent --remote-only

# Run remote agent without confirmation prompt
awesome-ai run coding-agent --remote -y

# Run an agent in a specific directory
awesome-ai run coding-agent --cwd ./my-project
```

---

### `exec`

Execute a prompt with an agent after approval. The prompt is loaded and displayed for review before the agent runs.

```bash
awesome-ai exec <prompt> [agent] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `prompt` | Name of the prompt to execute (required) |
| `agent` | Name of the agent to use (optional for local, required for remote) |

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --cwd <path>` | Working directory | Current directory |
| `-r, --remote` | Use agents/prompts from the remote registry (downloads if missing) | `false` |
| `--remote-only` | Use only remote agents/prompts (ignore local `agents.json`) | `false` |
| `-y, --yes` | Skip confirmation prompt for remote sync | `false` |

> **Note:** Without `--remote` or `--remote-only`, requires an initialized project with `agents.json` configuration and the prompt file in your prompts directory.

**Examples:**

```bash
# Execute a prompt with the default local agent
awesome-ai exec pages-to-app-router

# Execute a prompt with a specific agent
awesome-ai exec pages-to-app-router migration-planning-agent

# Execute using remote agents and prompts (downloads if not cached)
awesome-ai exec pages-to-app-router coding-agent --remote

# Execute using only remote registry (no local setup needed)
awesome-ai exec pages-to-app-router coding-agent --remote-only

# Execute remote without confirmation prompt
awesome-ai exec pages-to-app-router coding-agent --remote -y

# Execute in a specific directory
awesome-ai exec pages-to-app-router --cwd ./my-nextjs-project
```

**Workflow:**

1. The prompt is loaded from your prompts directory (or remote registry)
2. You review the prompt content in the TUI
3. You approve or modify the prompt
4. The agent executes the approved prompt

---

### `migrate`

Run a migration workflow with the specialized planning and execution agents. This command orchestrates a two-phase migration process.

```bash
awesome-ai migrate <prompt> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `prompt` | Name of the migration prompt to execute (required) |

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --cwd <path>` | Working directory | Current directory |
| `-r, --remote` | Use agents/prompts from the remote registry (downloads if missing) | `false` |
| `--remote-only` | Use only remote agents/prompts (ignore local `agents.json`) | `false` |
| `-y, --yes` | Skip confirmation prompt for remote sync | `false` |

**Required Agents:**

This command requires both migration agents to be available:
- `migration-planning-agent` - Creates the migration plan (read-only analysis)
- `migration-agent` - Executes the migration plan (makes changes)

When using `--remote` or `--remote-only`, these agents are automatically downloaded from the registry along with the specified prompt.

**Examples:**

```bash
# Run migration with local agents (requires agents to be installed)
awesome-ai migrate pages-to-app-router

# Run migration using remote registry (downloads agents and prompt automatically)
awesome-ai migrate pages-to-app-router --remote

# Run migration using only remote registry (no local setup needed)
awesome-ai migrate pages-to-app-router --remote-only

# Run remote migration without confirmation prompt
awesome-ai migrate pages-to-app-router --remote -y

# Run migration in a specific directory
awesome-ai migrate pages-to-app-router --cwd ./my-nextjs-project
```

**Workflow:**

1. The migration prompt is loaded (e.g., `pages-to-app-router`)
2. The `migration-planning-agent` analyzes the codebase and creates a detailed plan
3. You review the migration plan
4. The `migration-agent` executes the plan phase by phase
5. Each phase is verified before proceeding

**Local Setup (without --remote):**

```bash
# 1. Add the migration prompt
awesome-ai add pages-to-app-router --prompt

# 2. Add required agents
awesome-ai add migration-planning-agent migration-agent

# 3. Run the migration
awesome-ai migrate pages-to-app-router --cwd ./my-nextjs-app
```

**Quick Start with Remote (no local setup needed):**

```bash
# Run migration directly from remote registry
awesome-ai migrate pages-to-app-router --remote-only --cwd ./my-nextjs-app
```

The `pages-to-app-router` prompt guides the agents through:
- Analyzing your pages/ directory structure
- Creating a phased migration plan with Server/Client component boundaries
- Migrating data fetching patterns (getStaticProps → Server Components)
- Converting API routes to Route Handlers
- Preserving SEO metadata and rendering strategies

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
      "params": {
        "version": "latest"
      },
      "headers": {
        "Authorization": "Bearer ${MY_AUTH_TOKEN}"
      }
    }
  }
}
```

**Registry URL Requirements:**
- Registry names must start with `@` (e.g., `@my-registry`)
- URLs must include `{type}` and `{name}` placeholders
- Headers can reference environment variables using `${VAR_NAME}` syntax

---

## Environment Variables

### `AWESOME_AI_REGISTRY_URL` / `REGISTRY_URL`

Override the default registry URL:

```bash
AWESOME_AI_REGISTRY_URL=https://my-registry.com awesome-ai list
```

The CLI checks `AWESOME_AI_REGISTRY_URL` first, then falls back to `REGISTRY_URL`.

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

---

## Available Registry Items

### Agents

| Agent | Description |
|-------|-------------|
| `coding-agent` | Full-featured coding assistant with read, write, edit, bash, and search tools |
| `research-agent` | Read-only agent for exploring and understanding codebases |
| `planning-agent` | Agent for planning tasks with read-only bash access |
| `migration-planning-agent` | Specialized agent for planning code migrations (read-only) |
| `migration-agent` | Specialized agent for executing code migrations |

### Tools

| Tool | Description |
|------|-------------|
| `read` | Read files with line numbers, binary detection, and partial reads |
| `write` | Create or overwrite files with diff output |
| `edit` | Search and replace with fuzzy matching and multiple strategies |
| `bash` | Execute shell commands with streaming output and timeout |
| `list` | List directory contents using ripgrep |
| `grep` | Search file contents with regex patterns |
| `glob` | Find files matching glob patterns |
| `todo` | Task management for tracking work items |

### Prompts

| Prompt | Description |
|--------|-------------|
| `coding-agent` | System prompt for the coding agent |
| `research-agent` | System prompt for the research agent |
| `planning-agent` | System prompt for the planning agent |
| `migration-planning-agent` | System prompt for the migration planning agent |
| `migration-agent` | System prompt for the migration execution agent |
| `pages-to-app-router` | Migration prompt for Next.js Pages Router to App Router migrations |

---

## Registry Item Schema

Items in the registry follow this schema:

```typescript
{
  name: string           // Item name (required)
  type: string           // "registry:agent" | "registry:tool" | "registry:prompt" | "registry:lib"
  title?: string         // Display title
  author?: string        // Author name (min 2 chars)
  description?: string   // Description
  dependencies?: string[]      // npm dependencies
  devDependencies?: string[]   // npm dev dependencies
  registryDependencies?: string[]  // Other registry items this depends on
  files?: {
    path: string         // File path
    content?: string     // File content
    type: string         // File type (registry:agent, registry:tool, etc.)
    target?: string      // Target path override
  }[]
  meta?: Record<string, any>   // Additional metadata
  docs?: string          // Documentation/usage notes
  categories?: string[]  // Categories for organization
}
```

---

## Features

- **Remote Execution**: Run agents directly from the registry without local setup using `--remote` or `--remote-only` flags
- **Automatic Dependency Resolution**: When adding an agent, the CLI automatically downloads any tools, prompts, and library dependencies it requires
- **Topological Sorting**: Dependencies are resolved in the correct order, handling complex dependency trees
- **Circular Dependency Detection**: Warns when circular dependencies are detected
- **Import Transformation**: Automatically transforms imports to use your configured path aliases (`@/tools`, `@/agents`, etc.)
- **Package Manager Detection**: Detects your package manager (npm, pnpm, yarn, bun, deno) and installs npm dependencies automatically
- **TypeScript Support**: Full TypeScript support with `.ts` and `.tsx` file handling
- **File Conflict Handling**: Prompts for confirmation before overwriting existing files
- **Diff Preview**: Shows colorized diff output when checking for updates
- **Custom Registries**: Support for multiple registries with authentication
- **Interactive TUI**: Built-in terminal UI for chatting with agents

---

## Examples

### Setting Up a New Project

```bash
# Create a new project
mkdir my-ai-project && cd my-ai-project
pnpm init

# Initialize the CLI
awesome-ai init

# Add the coding agent with all its dependencies
awesome-ai add coding-agent
```

### Working with Tools

```bash
# List available tools
awesome-ai list --type tools

# Add multiple tools at once
awesome-ai add bash edit write grep --tool

# View tool details
awesome-ai view edit --type tools

# Check for tool updates
awesome-ai diff edit --type tools

# Update a tool
awesome-ai add edit --tool --overwrite
```

### Using Multiple Registries

```bash
# Add an agent from a custom registry
awesome-ai add @my-registry/custom-agent

# List items from a specific registry
awesome-ai list --registry @my-registry
```

### Running Agents Interactively

```bash
# Start an interactive session with a local agent
awesome-ai run coding-agent

# Run an agent from the remote registry (no local setup needed)
awesome-ai run coding-agent --remote-only

# Combine local and remote agents
awesome-ai run coding-agent --remote

# Start with a different working directory
awesome-ai run coding-agent --cwd ./my-project
```

### Checking for Updates

```bash
# See what changed in an agent
awesome-ai diff coding-agent --type agents

# Update by overwriting
awesome-ai add coding-agent --overwrite
```

---

## Using Agents Programmatically

After adding an agent via the CLI, you can use it in your code:

```typescript
import { createAgent } from "@/agents/coding-agent"
import { openai } from "@ai-sdk/openai"

const agent = await createAgent({
  model: openai("gpt-4o"),
  cwd: process.cwd(),
})

// The agent is ready to use with the Vercel AI SDK
```

### Using Tools Directly

```typescript
import { readTool, editTool, bashTool } from "@/tools"
import { generateText } from "ai"

const result = await generateText({
  model: yourModel,
  tools: {
    read: readTool,
    edit: editTool,
    bash: bashTool,
  },
  prompt: "Read the package.json file",
})
```

### Standalone Tool Execution

```typescript
import { readTool } from "@/tools/read"

// Execute a tool directly using its generator
const generator = readTool.execute({
  filePath: "/path/to/file.ts",
  offset: 0,
  limit: 100,
})

for await (const output of generator) {
  if (output.status === "success") {
    console.log(output.content)
  }
}
```

---

## License

MIT
