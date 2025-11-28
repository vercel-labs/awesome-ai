# Agent Tools

This directory contains standalone tools that can be used with AI agents.

## Installation

Tools can be added to your project using the CLI:

```bash
# Initialize your project (creates agents.json config)
npx awesome-ai init

# Add a single tool
npx awesome-ai add read --type tools

# Add multiple tools at once
npx awesome-ai add read write edit bash --type tools

# Add all core tools
npx awesome-ai add read write edit bash list grep glob --type tools
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `npx awesome-ai list --type tools` | List all available tools |
| `npx awesome-ai view <tool> --type tools` | View tool details and dependencies |
| `npx awesome-ai add <tool> --type tools` | Add a tool to your project |
| `npx awesome-ai diff <tool> --type tools` | Check for updates to a tool |

### Options

| Option | Description |
|--------|-------------|
| `-o, --overwrite` | Overwrite existing files |
| `-y, --yes` | Skip confirmation prompts |
| `-c, --cwd <path>` | Specify working directory |
| `-s, --silent` | Mute output |

### Example: Adding Tools to an Existing Project

```bash
# View available tools
npx awesome-ai list --type tools

# Add the edit tool (useful for search/replace operations)
npx awesome-ai add edit --type tools

# Check if your local tool has updates
npx awesome-ai diff edit --type tools

# Update a tool
npx awesome-ai add edit --type tools --overwrite
```

---

## Tools Overview

| Tool | Purpose |
|------|---------|
| `read` | Read files from the filesystem |
| `write` | Create or overwrite files |
| `edit` | Search and replace within files |
| `bash` | Execute shell commands |
| `list` | List directory contents |
| `grep` | Search file contents with regex |
| `glob` | Find files by name pattern |

---

## Read Tool

Reads files from the local filesystem with line numbers.

### Current Features
- Line-numbered output format (`00001| content`)
- Configurable offset and limit for partial reads
- **Extension-based binary detection** - Fast-path for 50+ known binary extensions (.zip, .exe, .wasm, .pdf, etc.)
- **Byte-level binary detection** - Fallback analysis for unknown extensions (null bytes, non-printable chars)
- **Sensitive file blocking** - Blocks `.env` files for security (allows `.env.example`, `.env.sample`)
- **External directory warning** - Warns when reading outside working directory
- **End of file indicator** - Shows total line count when file is fully read
- File suggestions when path not found
- Maximum line length truncation (2000 chars)
- Directory detection with helpful error message

### Potential Improvements
- [ ] **Image support** - Return images as base64 for vision-capable models
- [ ] **File read tracking** - Track when files were read for conflict detection

---

## Write Tool

Creates new files or overwrites existing files.

### Current Features
- Automatic directory creation (creates parent directories if needed)
- Detects if file exists vs created
- Absolute path resolution
- **External directory warning** - Warns when writing outside working directory
- **Diff output for overwrites** - Shows what changed when overwriting existing files
- **File statistics** - Reports line count and byte size in output
- **Rich metadata** - Includes `lineCount`, `byteSize`, `wasOverwrite`, `diff`, `warning`

### Potential Improvements
- [ ] **LSP diagnostics** - Return linter/type errors after writing so agent can fix them immediately
- [ ] **File conflict detection** - Verify file hasn't changed since it was last read before overwriting
- [ ] **Permission system** - Optional approval before writing files

---

## Edit Tool

Performs search and replace operations within files with fuzzy matching.

### Current Features
- **9 replacement strategies** (tried in order of preference):
  1. Exact string matching
  2. Line-trimmed matching (ignores leading/trailing whitespace per line)
  3. Block anchor matching (first/last line anchors with Levenshtein distance for fuzzy middle)
  4. Whitespace normalized matching (collapses multiple spaces/tabs)
  5. Indentation flexible matching (matches regardless of indentation level)
  6. Escape normalized matching (handles `\n`, `\t`, etc. in search strings)
  7. Trimmed boundary matching
  8. Context-aware matching (uses surrounding lines to disambiguate)
  9. Multi-occurrence matching (for `replaceAll` scenarios)
- `replaceAll` option for replacing all occurrences
- Diff output with trimmed indentation for cleaner display
- Empty `oldString` creates new file content
- Line ending normalization (handles CRLF → LF)

### Potential Improvements
- [ ] **LSP diagnostics** - Return linter errors after edit so agent can fix them immediately
- [ ] **File conflict detection** - Verify file hasn't changed since last read

---

## Bash Tool

Executes shell commands with output capture.

### Current Features
- Combined stdout/stderr capture
- Configurable timeout (default 1 min, max 10 min)
- Output truncation (30KB limit)
- Requires `description` parameter for clarity
- `needsApproval` flag for user confirmation

### Potential Improvements
- [ ] **Command parsing** - Parse bash commands with tree-sitter for better understanding
- [ ] **Granular permissions** - Allow/deny/ask for specific commands (e.g., `rm *`, `git push`)
- [ ] **Real-time output streaming** - Stream output as it's produced instead of waiting for completion
- [ ] **Process tree killing** - Properly kill child processes on timeout (SIGTERM → SIGKILL)
- [ ] **External directory detection** - Warn when commands reference paths outside project
- [ ] **Shell detection** - Auto-detect and use appropriate shell (zsh, bash, etc.)

---

## List Tool

Lists files and directories in a tree format.

### Current Features
- Recursive directory walking
- Tree-style output format
- Hardcoded ignore patterns (node_modules, .git, dist, etc.)
- Custom ignore patterns via parameter
- 100 file limit with truncation notice

### Potential Improvements
- [ ] **Use ripgrep** - Much faster file listing with `rg --files`
- [ ] **Respect .gitignore** - Honor project's gitignore rules
- [ ] **File metadata** - Show file sizes, modification times

---

## Grep Tool

Searches for regex patterns in file contents.

### Current Features
- Recursive search with line numbers
- File pattern filtering (`--include`)
- Groups results by file
- 100 match limit with truncation notice
- Extended regex support (`-E`)

### Potential Improvements
- [ ] **Use ripgrep** - Much faster than system grep, better defaults
- [ ] **Sort by modification time** - Show recently modified files first
- [ ] **Context lines** - Show lines before/after matches (`-A`, `-B`, `-C`)
- [ ] **Respect .gitignore** - Honor project's gitignore rules by default

---

## Glob Tool

Finds files matching a glob pattern.

### Current Features
- Recursive file search
- Basic glob pattern support (`*`, `?`)
- Sorts results by modification time (most recent first)
- 100 file limit
- Ignores common directories (node_modules, .git, dist, build)

### Potential Improvements
- [ ] **Use ripgrep** - Much faster glob matching with `rg --files --glob`
- [ ] **Full glob syntax** - Support `**`, `{a,b}`, `[abc]` patterns
- [ ] **Respect .gitignore** - Honor project's gitignore rules by default

---

## Implementation Notes

### Tool Output Schema

All tools use a consistent output schema via `toolOutput()`:

```typescript
toolOutput({
  pending: { /* fields shown while running */ },
  success: { /* fields on success */ },
  error: { /* fields on error */ },
})
```

### Generator Pattern

Tools use async generators to yield intermediate states:

```typescript
async *execute(params) {
  yield { status: "pending", message: "Working..." }
  // ... do work ...
  yield { status: "success", result: "Done" }
}
```

### Path Handling

All tools resolve relative paths against `process.cwd()`. The description recommends absolute paths for clarity.

---

## Using Tools Programmatically

After adding tools via the CLI, you can use them directly in your code:

```typescript
import { readTool } from "@/tools/read"
import { editTool } from "@/tools/edit"
import { bashTool } from "@/tools/bash"

// Tools are compatible with the Vercel AI SDK
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

### Standalone Execution

Tools can also be executed directly without an AI model:

```typescript
import { readTool } from "@/tools/read"

// Execute the tool directly using its execute generator
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

### Combining with Agents

Tools are designed to work seamlessly with the coding agent:

```typescript
import { createAgent } from "@/agents/coding-agent"
import { openai } from "@ai-sdk/openai"

const agent = createAgent({
  model: openai("gpt-4o"),
  workingDirectory: process.cwd(),
})

// The agent automatically has access to all core tools
```

