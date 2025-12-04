# Awesome AI

A CLI and terminal UI for adding AI agents, tools, and prompts to your projects from a curated registry.

## Packages

| Package | Description |
|---------|-------------|
| [awesome-ai](./packages/cli) | CLI for managing agents, tools, and prompts |
| [awesome-ai-tui](./apps/tui) | Interactive terminal UI for chatting with agents |

## Prerequisites

The CLI requires [Bun](https://bun.sh) to be installed:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Quick Start

```bash
# Install the CLI globally
npm install -g awesome-ai

# Initialize your project
awesome-ai init

# Add an agent (includes all dependencies)
awesome-ai add coding-agent

# Run the agent interactively
awesome-ai run coding-agent
```

## What's in the Registry?

The registry includes agents, tools, and prompts. Run `awesome-ai list` to see available items, or check the [CLI documentation](./packages/cli/README.md#available-registry-items) for a full reference.

Run `awesome-ai --help` to see all available commands, or check the [CLI documentation](./packages/cli/README.md) for detailed usage.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Build the registry JSON files
pnpm build:registry
```

## License

MIT