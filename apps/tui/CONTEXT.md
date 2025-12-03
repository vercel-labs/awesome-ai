# TUI Context for AI Workspace

## Architecture Overview

We've built a TUI at `awesome-ai/apps/tui` using **opentui** that connects to agents from user projects.

**Key Flow:**
- CLI (`packages/cli/src/commands/run.ts`) reads `agents.json`, resolves the agents path, and passes it to the TUI
- TUI receives `{ agentsPath, initialAgent, cwd }` and scans the folder for agent files
- Agent execution uses the AI SDK directly via `agent.stream()` (no HTTP transport)

## Key Files

| File | Purpose |
|------|---------|
| `apps/tui/src/index.tsx` | Main Chat component, global keyboard shortcuts |
| `apps/tui/src/components/atoms.ts` | All state atoms (messages as `Atom<Atom<TUIMessage>[]>` for granular updates) |
| `apps/tui/src/components/message-list.tsx` | Renders messages, each with its own atom subscription |
| `apps/tui/src/components/tool-part.tsx` | Tool invocation display with status, spinner, collapsible I/O |
| `apps/tui/src/components/ui/spinner.tsx` | Reusable animated spinner component |
| `apps/tui/src/components/thinking-section.tsx` | Collapsible reasoning display |
| `apps/tui/src/utils/agent.ts` | Agent loading/streaming logic (`loadAgent()`, `sendMessage()`) |
| `apps/tui/src/types.ts` | `TUIMessage` type, message helpers, tool output helpers |
| `apps/tui/src/test-conversation.json` | Test data with various tool states |

## Messages Architecture

Messages use `Atom<Atom<TUIMessage>[]>` pattern:
- Outer atom = list of message atoms (updates when new message added)
- Inner atoms = individual messages (updates during streaming without re-rendering other messages)
- Helper: `addMessage(msg)` creates atom and returns it for streaming updates

## Tool Display

Tools follow the registry schema from `packages/registry/src/tools/lib/tool-output.ts`:
```ts
{ status: "pending" | "streaming" | "success" | "error", message: string, ...fields }
```

AI SDK tool states: `input-streaming`, `input-available`, `approval-requested`, `approval-responded`, `output-available`, `output-error`, `output-denied`

## Currently Handled Message Parts
- `text` - Main content
- `reasoning` - Collapsible thinking
- `tool-*` / `dynamic-tool` - Full tool UI with spinner animation

## Not Yet Implemented
1. **Tool Approval UI** - `approval-requested` shows text but no approve/deny interaction
2. **Source parts** - `source-url`, `source-document` for citations
3. **File parts** - `file` attachments
4. **Streaming text indicator** - Show when text is still generating

## AI SDK Reference
The AI SDK source is available at `/Users/fades/all/vercel/ai` - check `packages/ai/src/ui/ui-messages.ts` for UI message types.

