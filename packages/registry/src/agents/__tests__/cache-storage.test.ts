import { describe, expect, it } from "vitest"
import {
	type CacheStorage,
	createSubagentRuntimeKeyspace,
	MemoryCacheStorage,
} from "@/agents/lib/cache-storage"

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

describe("MemoryCacheStorage", () => {
	it("stores and retrieves typed values", async () => {
		const storage = new MemoryCacheStorage()
		await storage.set("agent:1", { id: "agent:1", depth: 2 })
		const value = await storage.get<{ id: string; depth: number }>("agent:1")
		expect(value).toEqual({ id: "agent:1", depth: 2 })
	})

	it("expires values with ttl", async () => {
		const storage = new MemoryCacheStorage()
		await storage.set("ttl:key", { ok: true }, 10)
		expect(await storage.has("ttl:key")).toBe(true)
		await sleep(20)
		expect(await storage.get("ttl:key")).toBeUndefined()
		expect(await storage.has("ttl:key")).toBe(false)
	})

	it("supports prefix keys and clear", async () => {
		const storage = new MemoryCacheStorage()
		await storage.set("subagent:a", 1)
		await storage.set("subagent:b", 2)
		await storage.set("other:c", 3)
		const keys = await storage.keys("subagent:")
		expect(keys.sort()).toEqual(["subagent:a", "subagent:b"])
		await storage.clear("subagent:")
		expect(await storage.has("subagent:a")).toBe(false)
		expect(await storage.has("subagent:b")).toBe(false)
		expect(await storage.has("other:c")).toBe(true)
	})
})

class CustomMapStorage implements CacheStorage {
	private readonly inner = new Map<string, unknown>()

	async get<T>(key: string): Promise<T | undefined> {
		return this.inner.get(key) as T | undefined
	}
	async set<T>(key: string, value: T): Promise<void> {
		this.inner.set(key, value)
	}
	async delete(key: string): Promise<boolean> {
		return this.inner.delete(key)
	}
	async clear(prefix?: string): Promise<void> {
		if (!prefix) {
			this.inner.clear()
			return
		}
		for (const key of this.inner.keys()) {
			if (key.startsWith(prefix)) {
				this.inner.delete(key)
			}
		}
	}
	async has(key: string): Promise<boolean> {
		return this.inner.has(key)
	}
	async keys(prefix?: string): Promise<string[]> {
		return Array.from(this.inner.keys()).filter((key) => !prefix || key.startsWith(prefix))
	}
}

describe("storage contract utilities", () => {
	it("creates namespaced runtime keyspace contract", () => {
		const keyspace = createSubagentRuntimeKeyspace("runtime_abc")
		expect(keyspace.prefix).toBe("subagent:runtime_abc")
		expect(keyspace.counter).toBe("subagent:runtime_abc:counter")
		expect(keyspace.metrics).toBe("subagent:runtime_abc:metrics")
		expect(keyspace.status("agent_1")).toBe("subagent:runtime_abc:status:agent_1")
		expect(keyspace.lineage("agent_1")).toBe("subagent:runtime_abc:lineage:agent_1")
	})

	it("supports custom storage adapters", async () => {
		const storage = new CustomMapStorage()
		await storage.set("subagent:r:counter", 1)
		await storage.set("subagent:r:status:a1", { id: "a1" })
		expect(await storage.get<number>("subagent:r:counter")).toBe(1)
		expect(await storage.has("subagent:r:status:a1")).toBe(true)
		expect((await storage.keys("subagent:r:")).length).toBe(2)
	})
})
