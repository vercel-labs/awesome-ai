import { atom } from "@lfades/atom"
import type { TextareaRenderable } from "@opentui/core"
import type { TUIMessage } from "../types"
import type { DiscoveredAgent } from "../utils/agent-discovery"
import type { AvailableModel } from "../utils/models"

// Test conversation for development using UIMessage structure
const testConversation: TUIMessage[] = [
	{
		id: "msg-1",
		role: "system",
		metadata: { timestamp: "[09:00:01]" },
		parts: [
			{ type: "text", text: "agent v1.0.0 initialized. ready for input." },
		],
	},
	{
		id: "msg-2",
		role: "user",
		metadata: { timestamp: "[09:00:15]" },
		parts: [{ type: "text", text: "Help me create a todo app in TypeScript" }],
	},
	{
		id: "msg-3",
		role: "assistant",
		metadata: { timestamp: "[09:00:18]" },
		parts: [
			{
				type: "reasoning",
				text: `The user wants to create a todo app in TypeScript. I should:
1. Start with project setup - they'll need npm init and typescript
2. Define the core Todo interface first - this establishes the data model
3. Keep it simple initially - id, title, completed, createdAt are the essentials
4. Ask if they want to continue before diving into implementation details
5. Use TypeScript best practices like proper typing`,
			},
			{
				type: "text",
				text: `I'd be happy to help you create a todo app! Let's start with the basic structure.

## Project Setup

First, create a new directory and initialize the project:

\`\`\`bash
mkdir todo-app && cd todo-app
npm init -y
npm install typescript @types/node
\`\`\`

## Todo Interface

Here's the core interface for our todos:

\`\`\`typescript
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}
\`\`\`

Would you like me to continue with the implementation?`,
			},
		],
	},
	{
		id: "msg-4",
		role: "user",
		metadata: { timestamp: "[09:00:45]" },
		parts: [
			{
				type: "text",
				text: "Yes, show me how to implement the CRUD operations",
			},
		],
	},
	{
		id: "msg-5",
		role: "assistant",
		metadata: { timestamp: "[09:00:52]" },
		parts: [
			{
				type: "reasoning",
				text: `User wants CRUD operations. Let me think about the best approach:

Data structure choice:
- Array: Simple but O(n) for lookups by id
- Map: O(1) lookups, perfect for id-based operations
- Object: Similar to Map but Map is cleaner in TypeScript

Going with Map<string, Todo> for:
- Fast lookups: get(id) is O(1)
- Easy iteration: values() for listing
- Built-in delete: delete(id) returns boolean

For update, I'll use Partial<Todo> to allow updating any subset of fields.
Should return null for missing items to distinguish from undefined fields.

crypto.randomUUID() is available in modern Node.js and browsers - good choice for IDs.`,
			},
			{
				type: "text",
				text: `Here's a complete **TodoService** class with all CRUD operations:

\`\`\`typescript
class TodoService {
  private todos: Map<string, Todo> = new Map();

  create(title: string): Todo {
    const todo: Todo = {
      id: crypto.randomUUID(),
      title,
      completed: false,
      createdAt: new Date(),
    };
    this.todos.set(todo.id, todo);
    return todo;
  }

  read(id: string): Todo | undefined {
    return this.todos.get(id);
  }

  update(id: string, updates: Partial<Todo>): Todo | null {
    const todo = this.todos.get(id);
    if (!todo) return null;

    const updated = { ...todo, ...updates };
    this.todos.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.todos.delete(id);
  }

  list(): Todo[] {
    return Array.from(this.todos.values());
  }
}
\`\`\`

### Key Features:
- Uses \`Map\` for O(1) lookups
- Generates unique IDs with \`crypto.randomUUID()\`
- Supports partial updates
- Returns \`null\`/\`undefined\` for missing items`,
			},
		],
	},
	{
		id: "msg-6",
		role: "user",
		metadata: { timestamp: "[09:01:20]" },
		parts: [
			{ type: "text", text: "Can you add filtering by completed status?" },
		],
	},
	{
		id: "msg-7",
		role: "assistant",
		metadata: { timestamp: "[09:01:25]" },
		parts: [
			{
				type: "text",
				text: `Sure! Here's an enhanced \`list\` method with filtering:

\`\`\`typescript
list(filter?: { completed?: boolean }): Todo[] {
  const todos = Array.from(this.todos.values());

  if (filter?.completed !== undefined) {
    return todos.filter(t => t.completed === filter.completed);
  }

  return todos;
}
\`\`\`

**Usage examples:**
- \`service.list()\` → all todos
- \`service.list({ completed: true })\` → only completed
- \`service.list({ completed: false })\` → only pending

Would you also like me to add **sorting** or **search** functionality?`,
			},
		],
	},
	{
		id: "msg-8",
		role: "user",
		metadata: { timestamp: "[09:01:50]" },
		parts: [{ type: "text", text: "Yes, add search by title" }],
	},
	{
		id: "msg-9",
		role: "assistant",
		metadata: { timestamp: "[09:01:55]" },
		parts: [
			{
				type: "reasoning",
				text: `Adding search to the existing filter method. Design considerations:

1. Should I create a separate search method?
   - No, better to combine with existing list() for flexibility

2. Search behavior:
   - Case-insensitive (toLowerCase on both)
   - Partial match (includes not equals)
   - Only search title for now, could add description later

3. Interface design:
   - Create ListOptions interface for type safety
   - Both filters optional
   - Chainable - apply completed filter first, then search

4. Performance:
   - For small lists (<1000), chained filters are fine
   - For larger lists, might want to combine into single pass
   - Current approach is more readable`,
			},
			{
				type: "text",
				text: `Here's the updated method with both filtering and search:

\`\`\`typescript
interface ListOptions {
  completed?: boolean;
  search?: string;
}

list(options?: ListOptions): Todo[] {
  let todos = Array.from(this.todos.values());

  if (options?.completed !== undefined) {
    todos = todos.filter(t => t.completed === options.completed);
  }

  if (options?.search) {
    const query = options.search.toLowerCase();
    todos = todos.filter(t =>
      t.title.toLowerCase().includes(query)
    );
  }

  return todos;
}
\`\`\`

The search is **case-insensitive** and matches partial titles. You can combine both filters:

\`\`\`typescript
// Find incomplete todos containing "bug"
service.list({ completed: false, search: "bug" })
\`\`\``,
			},
		],
	},
]

// Start with empty messages - test conversation kept for development reference
export const messagesAtom = atom<TUIMessage[]>([])

export const isLoadingAtom = atom(false)
export const showDebugAtom = atom(false)
export const debugLogsAtom = atom<string[]>([])
export const selectedModelAtom = atom("claude-sonnet-4-20250514")
export const showCommandsAtom = atom(false)
export const commandFilterAtom = atom("")
export const selectedCommandAtom = atom(0)
export const showShortcutsAtom = atom(false)
export const inputAtom = atom<TextareaRenderable | null>(null)

// Agent selection
export const showAgentSelectorAtom = atom(false)
export const availableAgentsAtom = atom<DiscoveredAgent[]>([])
export const selectedAgentIndexAtom = atom(0)
export const currentAgentAtom = atom<string | null>(null)

// Model selection
export const showModelSelectorAtom = atom(false)
export const availableModelsAtom = atom<AvailableModel[]>([])
export const selectedModelIndexAtom = atom(0)
export const isLoadingModelsAtom = atom(false)

export function debugLog(...args: unknown[]) {
	const msg = args
		.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
		.join(" ")

	debugLogsAtom.set([...debugLogsAtom.get().slice(-99), msg])
}
