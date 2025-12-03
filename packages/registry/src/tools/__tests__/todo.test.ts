import type { Tool } from "ai"
import { describe, expect, it } from "vitest"
import { createTodoTools, type TodoItem, type TodoStorage } from "../todo"
import { executeTool } from "./lib/test-utils"

// Helper to execute a non-streaming tool and get the single result
async function execute<T extends Tool>(
	tool: T,
	input: Parameters<NonNullable<T["execute"]>>[0],
) {
	const results = await executeTool(tool, input)
	return results[0]
}

describe("createTodoTools", () => {
	it("creates todoRead and todoWrite tools", () => {
		const { todoRead, todoWrite } = createTodoTools()

		expect(todoRead).toBeDefined()
		expect(todoRead.execute).toBeDefined()
		expect(todoWrite).toBeDefined()
		expect(todoWrite.execute).toBeDefined()
	})

	it("uses in-memory storage by default", async () => {
		const { todoRead, todoWrite } = createTodoTools()

		// Write some todos
		await execute(todoWrite, {
			todos: [{ id: "1", content: "Test task", status: "pending" }],
		})

		// Read them back
		const result = await execute(todoRead, {})
		expect(result).toEqual({
			todos: [{ id: "1", content: "Test task", status: "pending" }],
			count: 1,
			pending: 1,
		})
	})

	it("accepts custom storage", async () => {
		const stored: TodoItem[] = []
		const customStorage: TodoStorage = {
			get: async () => stored,
			set: async (todos) => {
				stored.length = 0
				stored.push(...todos)
			},
		}

		const { todoRead, todoWrite } = createTodoTools(customStorage)

		await execute(todoWrite, {
			todos: [
				{ id: "custom-1", content: "Custom storage task", status: "pending" },
			],
		})

		expect(stored).toHaveLength(1)
		expect(stored[0]?.id).toBe("custom-1")

		const result = await execute(todoRead, {})
		expect(result).toMatchObject({ count: 1 })
	})
})

describe("todoRead", () => {
	it("returns empty list initially", async () => {
		const { todoRead } = createTodoTools()

		const result = await execute(todoRead, {})

		expect(result).toEqual({
			todos: [],
			count: 0,
			pending: 0,
		})
	})

	it("returns all todos with correct counts", async () => {
		const { todoRead, todoWrite } = createTodoTools()

		await execute(todoWrite, {
			todos: [
				{ id: "1", content: "Task 1", status: "pending" },
				{ id: "2", content: "Task 2", status: "in_progress" },
				{ id: "3", content: "Task 3", status: "completed" },
			],
		})

		const result = await execute(todoRead, {})

		expect(result).toEqual({
			todos: [
				{ id: "1", content: "Task 1", status: "pending" },
				{ id: "2", content: "Task 2", status: "in_progress" },
				{ id: "3", content: "Task 3", status: "completed" },
			],
			count: 3,
			pending: 2, // pending + in_progress
		})
	})
})

describe("todoWrite", () => {
	it("stores todos and returns updated list", async () => {
		const { todoWrite } = createTodoTools()

		const result = await execute(todoWrite, {
			todos: [
				{ id: "1", content: "First task", status: "pending" },
				{ id: "2", content: "Second task", status: "pending" },
			],
		})

		expect(result).toEqual({
			todos: [
				{ id: "1", content: "First task", status: "pending" },
				{ id: "2", content: "Second task", status: "pending" },
			],
			count: 2,
			pending: 2,
		})
	})

	it("replaces entire todo list on write", async () => {
		const { todoRead, todoWrite } = createTodoTools()

		// First write
		await execute(todoWrite, {
			todos: [
				{ id: "1", content: "Task A", status: "pending" },
				{ id: "2", content: "Task B", status: "pending" },
			],
		})

		// Second write (replaces all)
		await execute(todoWrite, {
			todos: [{ id: "3", content: "Task C", status: "in_progress" }],
		})

		const result = await execute(todoRead, {})

		expect(result).toEqual({
			todos: [{ id: "3", content: "Task C", status: "in_progress" }],
			count: 1,
			pending: 1,
		})
	})

	it("counts pending as pending + in_progress", async () => {
		const { todoWrite } = createTodoTools()

		const result = await execute(todoWrite, {
			todos: [
				{ id: "1", content: "Task 1", status: "pending" },
				{ id: "2", content: "Task 2", status: "in_progress" },
				{ id: "3", content: "Task 3", status: "completed" },
				{ id: "4", content: "Task 4", status: "cancelled" },
			],
		})

		expect(result).toMatchObject({
			count: 4,
			pending: 2, // Only pending and in_progress
		})
	})

	it("handles empty todo list", async () => {
		const { todoWrite } = createTodoTools()

		const result = await execute(todoWrite, { todos: [] })

		expect(result).toEqual({
			todos: [],
			count: 0,
			pending: 0,
		})
	})

	it("can clear todos by writing empty list", async () => {
		const { todoRead, todoWrite } = createTodoTools()

		// Add todos
		await execute(todoWrite, {
			todos: [{ id: "1", content: "Task", status: "pending" }],
		})

		// Clear todos
		await execute(todoWrite, { todos: [] })

		const result = await execute(todoRead, {})
		expect(result).toEqual({
			todos: [],
			count: 0,
			pending: 0,
		})
	})
})
