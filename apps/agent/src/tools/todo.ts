import { tool } from "ai"
import { z } from "zod"

export const TodoItem = z.object({
	id: z.string().describe("Unique identifier for the todo item"),
	content: z.string().describe("Brief description of the task"),
	status: z
		.enum(["pending", "in_progress", "completed", "cancelled"])
		.describe("Current status of the task"),
})

export type TodoItem = z.infer<typeof TodoItem>

export interface TodoStorage {
	get: () => Promise<TodoItem[]>
	set: (todos: TodoItem[]) => Promise<void>
}

function createInMemoryStorage(): TodoStorage {
	let todos: TodoItem[] = []
	return {
		get: async () => todos,
		set: async (newTodos) => {
			todos = newTodos
		},
	}
}

const TODO_READ_DESCRIPTION = `Read the current todo list for this session.

Use this tool frequently to stay aware of task status:
- At the beginning of conversations to see what's pending
- Before starting new tasks to prioritize work
- When uncertain about what to do next
- After completing tasks to update your understanding

Returns a list of todo items with their id, content, and status.
If no todos exist, an empty list is returned.`

const TODO_WRITE_DESCRIPTION = `Create and manage a structured task list for the current session.

## When to Use
- Complex multi-step tasks (3+ distinct steps)
- User provides multiple tasks (numbered or comma-separated)
- After receiving new instructions - capture requirements as todos
- After completing a task - mark complete and add follow-ups
- When starting a task - mark as in_progress (only one at a time)

## When NOT to Use
- Single, straightforward tasks
- Trivial tasks completable in <3 steps
- Purely conversational/informational requests

## Task States
- pending: Not yet started
- in_progress: Currently working on (limit to ONE at a time)
- completed: Finished successfully
- cancelled: No longer needed

## Task Management
- Update status in real-time as you work
- Mark tasks complete IMMEDIATELY after finishing
- Only have ONE task in_progress at any time
- Complete current tasks before starting new ones`

export function createTodoTools(storage?: TodoStorage) {
	const store = storage ?? createInMemoryStorage()

	const todoRead = tool({
		description: TODO_READ_DESCRIPTION,
		inputSchema: z.object({}),
		outputSchema: z.object({
			todos: z.array(TodoItem),
			count: z.number(),
			pending: z.number(),
		}),
		async execute() {
			const todos = await store.get()
			const pending = todos.filter(
				(t) => t.status === "pending" || t.status === "in_progress",
			).length

			return {
				todos,
				count: todos.length,
				pending,
			}
		},
	})

	const todoWrite = tool({
		description: TODO_WRITE_DESCRIPTION,
		inputSchema: z.object({
			todos: z.array(TodoItem).describe("The complete updated todo list"),
		}),
		outputSchema: z.object({
			todos: z.array(TodoItem),
			count: z.number(),
			pending: z.number(),
		}),
		async execute({ todos }) {
			await store.set(todos)
			const pending = todos.filter(
				(t) => t.status === "pending" || t.status === "in_progress",
			).length

			return {
				todos,
				count: todos.length,
				pending,
			}
		},
	})

	return { todoRead, todoWrite }
}
