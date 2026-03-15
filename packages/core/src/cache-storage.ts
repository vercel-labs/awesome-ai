export interface CacheStorage {
	get<T>(key: string): Promise<T | undefined>
	set<T>(key: string, value: T, ttlMs?: number): Promise<void>
	delete(key: string): Promise<boolean>
	clear(prefix?: string): Promise<void>
	has(key: string): Promise<boolean>
	keys(prefix?: string): Promise<string[]>
}

export interface SubagentStatusSnapshot {
	id: string
	type: string
	status: string
	depth: number
	parentId?: string
	forkContext: boolean
	createdAt: number
	updatedAt: number
	lastResponse?: string
	lastError?: string
	queueLength: number
	runtimeId: string
	resumableScope: "in_memory_runtime"
}

export interface SubagentLineageSnapshot {
	id: string
	parentId?: string
	depth: number
	type: string
	createdAt: number
	runtimeId: string
}

export interface SubagentMetricsSnapshot {
	runtimeId: string
	updatedAt: number
	metrics: Record<string, number>
}

export interface SubagentRuntimeKeyspace {
	prefix: string
	counter: string
	metrics: string
	status: (agentId: string) => string
	lineage: (agentId: string) => string
}

export function createSubagentRuntimeKeyspace(
	runtimeId: string,
): SubagentRuntimeKeyspace {
	const prefix = `subagent:${runtimeId}`
	return {
		prefix,
		counter: `${prefix}:counter`,
		metrics: `${prefix}:metrics`,
		status: (agentId: string) => `${prefix}:status:${agentId}`,
		lineage: (agentId: string) => `${prefix}:lineage:${agentId}`,
	}
}

interface MemoryEntry {
	value: unknown
	expiresAt?: number
}

function now() {
	return Date.now()
}

export class MemoryCacheStorage implements CacheStorage {
	private readonly store = new Map<string, MemoryEntry>()

	private isExpired(entry: MemoryEntry) {
		return typeof entry.expiresAt === "number" && entry.expiresAt <= now()
	}

	private cleanupKey(key: string, entry?: MemoryEntry) {
		if (!entry) return
		if (this.isExpired(entry)) {
			this.store.delete(key)
		}
	}

	async get<T>(key: string): Promise<T | undefined> {
		const entry = this.store.get(key)
		this.cleanupKey(key, entry)
		const current = this.store.get(key)
		return current?.value as T | undefined
	}

	async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
		const expiresAt = ttlMs && ttlMs > 0 ? now() + ttlMs : undefined
		this.store.set(key, { value, expiresAt })
	}

	async delete(key: string): Promise<boolean> {
		return this.store.delete(key)
	}

	async clear(prefix?: string): Promise<void> {
		if (!prefix) {
			this.store.clear()
			return
		}
		for (const key of this.store.keys()) {
			if (key.startsWith(prefix)) {
				this.store.delete(key)
			}
		}
	}

	async has(key: string): Promise<boolean> {
		const entry = this.store.get(key)
		this.cleanupKey(key, entry)
		return this.store.has(key)
	}

	async keys(prefix?: string): Promise<string[]> {
		const entries: string[] = []
		for (const [key, entry] of this.store.entries()) {
			this.cleanupKey(key, entry)
		}
		for (const key of this.store.keys()) {
			if (!prefix || key.startsWith(prefix)) {
				entries.push(key)
			}
		}
		return entries
	}
}
