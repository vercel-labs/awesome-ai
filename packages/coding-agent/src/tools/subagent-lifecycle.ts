import {
	type CacheStorage,
	checkPermission,
	createSubagentRuntimeKeyspace,
	DEFAULT_TASK_PERMISSIONS,
	MemoryCacheStorage,
	type PermissionPatterns,
	type SubagentLineageSnapshot,
	type SubagentMetricsSnapshot,
	type SubagentStatusSnapshot,
} from "@awesome-ai/core"
import { type LanguageModel, type ModelMessage, tool } from "ai"
import { z } from "zod"

export const SubagentStatus = z.enum([
	"pending_init",
	"running",
	"interrupted",
	"completed",
	"errored",
	"shutdown",
	"not_found",
	"timeout",
])

export type SubagentStatus = z.infer<typeof SubagentStatus>

interface AgentState {
	id: string
	type: string
	depth: number
	status: SubagentStatus
	createdAt: number
	updatedAt: number
	parentId?: string
	forkContext: boolean
	messages: ModelMessage[]
	queue: string[]
	agent?: RuntimeAgent
	running: boolean
	abortController?: AbortController
	abortReason?: "interrupt" | "close"
	lastResponse?: string
	lastError?: string
}

interface SpawnInput {
	type: string
	prompt: string
	parentId?: string
	forkContext: boolean
	parentMessages: ModelMessage[]
}

export interface RuntimeEvent {
	agentId: string
	status: SubagentStatus
	type: string
	depth: number
	parentId?: string
	error?: string
}

interface RuntimeOptions {
	model: LanguageModel
	resolveAgent: (input: {
		type: string
		model: LanguageModel
		agentId: string
		depth: number
	}) => Promise<RuntimeAgent>
	maxDepth?: number
	maxThreads?: number
	onStatus?: (event: RuntimeEvent) => void
	cacheStorage?: CacheStorage
}

const FINAL_STATUSES = new Set<SubagentStatus>([
	"interrupted",
	"completed",
	"errored",
	"shutdown",
	"not_found",
	"timeout",
])

const ACTIVE_STATUSES = new Set<SubagentStatus>(["pending_init", "running"])

export interface RuntimeMetrics {
	spawnSuccess: number
	spawnFailure: number
	depthCapHits: number
	threadCapHits: number
	sendInputs: number
	waits: number
	waitTimeouts: number
	interrupts: number
	closes: number
	resumes: number
}

interface RuntimeLogEntry {
	timestamp: number
	event:
		| "spawn_success"
		| "spawn_failure"
		| "depth_cap_hit"
		| "thread_cap_hit"
		| "send_input"
		| "wait_complete"
		| "wait_timeout"
		| "interrupt"
		| "close"
		| "resume"
	agentId?: string
	details?: Record<string, unknown>
}

export interface RuntimeAgent {
	stream: (input: { messages: ModelMessage[]; abortSignal?: AbortSignal }) => Promise<{
		response: Promise<{ messages: ModelMessage[] }>
	}>
}

function now() {
	return Date.now()
}

function messageToText(message: ModelMessage): string {
	if (typeof message.content === "string") {
		return message.content
	}
	if (!Array.isArray(message.content)) {
		return ""
	}
	return message.content
		.map((part) => {
			if ("text" in part && typeof part.text === "string") {
				return part.text
			}
			if ("value" in part) {
				return JSON.stringify(part.value)
			}
			return ""
		})
		.filter(Boolean)
		.join("\n")
}

function cloneMessages(messages: ModelMessage[]): ModelMessage[] {
	return structuredClone(messages)
}

export class SubagentRuntime {
	private readonly model: LanguageModel
	private readonly resolveAgent: RuntimeOptions["resolveAgent"]
	private readonly maxDepth: number
	private readonly maxThreads: number
	private readonly onStatus?: RuntimeOptions["onStatus"]
	private readonly agents = new Map<string, AgentState>()
	private readonly cacheStorage: CacheStorage
	private readonly runtimeId: string
	private readonly keyspace: ReturnType<typeof createSubagentRuntimeKeyspace>
	private readonly metrics: RuntimeMetrics = {
		spawnSuccess: 0,
		spawnFailure: 0,
		depthCapHits: 0,
		threadCapHits: 0,
		sendInputs: 0,
		waits: 0,
		waitTimeouts: 0,
		interrupts: 0,
		closes: 0,
		resumes: 0,
	}
	private readonly logs: RuntimeLogEntry[] = []

	constructor(options: RuntimeOptions) {
		this.model = options.model
		this.resolveAgent = options.resolveAgent
		this.maxDepth = options.maxDepth ?? 3
		this.maxThreads = options.maxThreads ?? 4
		this.onStatus = options.onStatus
		this.cacheStorage = options.cacheStorage ?? new MemoryCacheStorage()
		this.runtimeId = `runtime_${Math.random().toString(36).slice(2, 10)}`
		this.keyspace = createSubagentRuntimeKeyspace(this.runtimeId)
	}

	private async nextAgentId() {
		const key = this.keyspace.counter
		const counter = (await this.cacheStorage.get<number>(key)) ?? 0
		const nextCounter = counter + 1
		await this.cacheStorage.set(key, nextCounter)
		return `agent_${this.runtimeId}_${String(nextCounter).padStart(6, "0")}`
	}

	private async persistStateSnapshot(state: AgentState) {
		const snapshot: SubagentStatusSnapshot = {
			id: state.id,
			type: state.type,
			status: state.status,
			depth: state.depth,
			parentId: state.parentId,
			forkContext: state.forkContext,
			createdAt: state.createdAt,
			updatedAt: state.updatedAt,
			lastResponse: state.lastResponse,
			lastError: state.lastError,
			queueLength: state.queue.length,
			runtimeId: this.runtimeId,
			resumableScope: "in_memory_runtime" as const,
		}
		await this.cacheStorage.set(this.keyspace.status(state.id), snapshot)
	}

	private async persistLineage(state: AgentState) {
		const snapshot: SubagentLineageSnapshot = {
			id: state.id,
			parentId: state.parentId,
			depth: state.depth,
			type: state.type,
			createdAt: state.createdAt,
			runtimeId: this.runtimeId,
		}
		await this.cacheStorage.set(this.keyspace.lineage(state.id), snapshot)
	}

	private async persistMetricsSnapshot() {
		const snapshot: SubagentMetricsSnapshot = {
			runtimeId: this.runtimeId,
			updatedAt: now(),
			metrics: { ...this.metrics },
		}
		await this.cacheStorage.set(this.keyspace.metrics, snapshot)
	}

	private emit(state: AgentState) {
		this.onStatus?.({
			agentId: state.id,
			status: state.status,
			type: state.type,
			depth: state.depth,
			parentId: state.parentId,
			error: state.lastError,
		})
	}

	private setStatus(state: AgentState, status: SubagentStatus, error?: string) {
		state.status = status
		state.updatedAt = now()
		if (error) {
			state.lastError = error
		}
		this.emit(state)
		void this.persistStateSnapshot(state)
	}

	private bump(metric: keyof RuntimeMetrics) {
		this.metrics[metric] += 1
		void this.persistMetricsSnapshot()
	}

	private log(
		event: RuntimeLogEntry["event"],
		agentId?: string,
		details?: Record<string, unknown>,
	) {
		this.logs.push({
			timestamp: now(),
			event,
			agentId,
			details,
		})
		if (this.logs.length > 200) {
			this.logs.shift()
		}
	}

	private isActiveStatus(status: SubagentStatus) {
		return ACTIVE_STATUSES.has(status)
	}

	private activeAgentCount() {
		let total = 0
		for (const state of this.agents.values()) {
			if (this.isActiveStatus(state.status)) {
				total++
			}
		}
		return total
	}

	private getDepth(parentId?: string) {
		if (!parentId) {
			return 1
		}
		const parent = this.agents.get(parentId)
		if (!parent) {
			return 1
		}
		return parent.depth + 1
	}

	private isFinal(status: SubagentStatus) {
		return FINAL_STATUSES.has(status)
	}

	private async ensureRunning(state: AgentState) {
		if (state.running) {
			return
		}
		state.running = true
		while (state.queue.length > 0 && state.status !== "shutdown") {
			const nextPrompt = state.queue.shift()
			if (!nextPrompt) {
				continue
			}
			const inputMessage: ModelMessage = { role: "user", content: nextPrompt }
			state.messages.push(inputMessage)
			this.setStatus(state, "running")
			state.abortController = new AbortController()
			state.abortReason = undefined
			try {
				const result = await state.agent!.stream({
					messages: cloneMessages(state.messages),
					abortSignal: state.abortController.signal,
				})
				const response = await result.response
				state.messages.push(...response.messages)
				const lastAssistant = response.messages
					.slice()
					.reverse()
					.find((msg) => msg.role === "assistant")
				state.lastResponse = lastAssistant
					? messageToText(lastAssistant)
					: "Completed without assistant text output."
				this.setStatus(state, "completed")
			} catch (error) {
				if (state.abortController?.signal.aborted) {
					if (state.abortReason === "interrupt") {
						state.queue = []
						this.setStatus(state, "interrupted")
					}
					break
				}
				const message = error instanceof Error ? error.message : String(error)
				this.setStatus(state, "errored", message)
				break
			} finally {
				state.abortController = undefined
				state.abortReason = undefined
			}
		}
		state.running = false
	}

	async spawn(input: SpawnInput) {
		const currentActive = this.activeAgentCount()
		if (currentActive >= this.maxThreads) {
			this.bump("threadCapHits")
			this.log("thread_cap_hit", undefined, {
				maxThreads: this.maxThreads,
				currentActive,
			})
			throw new Error(
				`Subagent thread limit reached (${this.maxThreads}). Close existing subagents before spawning new ones.`,
			)
		}

		const depth = this.getDepth(input.parentId)
		if (depth > this.maxDepth) {
			this.bump("depthCapHits")
			this.log("depth_cap_hit", undefined, { maxDepth: this.maxDepth, depth })
			throw new Error(`Subagent depth limit reached (${this.maxDepth}).`)
		}

		const id = await this.nextAgentId()
		const seedMessages = input.forkContext ? cloneMessages(input.parentMessages) : []
		const state: AgentState = {
			id,
			type: input.type,
			depth,
			status: "pending_init",
			createdAt: now(),
			updatedAt: now(),
			parentId: input.parentId,
			forkContext: input.forkContext,
			messages: seedMessages,
			queue: [input.prompt],
			running: false,
		}
		this.agents.set(id, state)
		this.emit(state)
		await this.persistLineage(state)
		await this.persistStateSnapshot(state)
		try {
			state.agent = await this.resolveAgent({
				type: input.type,
				model: this.model,
				agentId: id,
				depth,
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.setStatus(state, "errored", message)
			this.bump("spawnFailure")
			this.log("spawn_failure", id, { error: message })
			return state
		}
		this.bump("spawnSuccess")
		this.log("spawn_success", id, { type: state.type, depth: state.depth })
		void this.ensureRunning(state)
		return state
	}

	async sendInput(agentId: string, prompt: string) {
		const state = this.agents.get(agentId)
		if (!state) {
			return undefined
		}
		if (state.status === "shutdown") {
			throw new Error(`Subagent ${agentId} is shutdown. Resume it before sending input.`)
		}
		state.queue.push(prompt)
		state.updatedAt = now()
		this.bump("sendInputs")
		this.log("send_input", agentId, { queueLength: state.queue.length })
		void this.ensureRunning(state)
		return state
	}

	async wait(agentIds: string[], timeoutMs: number) {
		this.bump("waits")
		const start = now()
		const timeoutAt = start + timeoutMs
		while (now() < timeoutAt) {
			const statuses = agentIds.map((id) => this.getStatus(id))
			if (statuses.every((entry) => this.isFinal(entry.status))) {
				const waitedMs = now() - start
				this.log("wait_complete", undefined, { waitedMs, timeoutMs })
				return {
					timeoutMs,
					waitedMs,
					timedOut: false,
					agents: statuses.map((entry) => ({
						...entry,
						waitStatus: "final" as const,
					})),
				}
			}
			await new Promise((resolve) => setTimeout(resolve, 100))
		}
		this.bump("waitTimeouts")
		const timedOutAgents = agentIds.map((id) => {
			const current = this.getStatus(id)
			if (this.isFinal(current.status)) {
				return {
					...current,
					waitStatus: "final" as const,
				}
			}
			return {
				...current,
				status: "timeout" as const,
				waitStatus: "timeout" as const,
			}
		})
		this.log("wait_timeout", undefined, {
			timeoutMs,
			waitedMs: now() - start,
			timedOutAgents: timedOutAgents.filter((entry) => entry.waitStatus === "timeout").length,
		})
		return {
			timeoutMs,
			waitedMs: now() - start,
			timedOut: true,
			agents: timedOutAgents,
		}
	}

	async close(agentId: string) {
		const state = this.agents.get(agentId)
		if (!state) {
			return undefined
		}
		this.bump("closes")
		this.log("close", agentId)
		state.abortReason = "close"
		state.abortController?.abort()
		this.setStatus(state, "shutdown")
		return state
	}

	async interrupt(agentId: string) {
		const state = this.agents.get(agentId)
		if (!state) {
			return undefined
		}
		if (state.status === "shutdown") {
			throw new Error(`Subagent ${agentId} is shutdown. Resume it before interrupting.`)
		}
		this.bump("interrupts")
		this.log("interrupt", agentId, {
			wasRunning: state.running,
			queueLength: state.queue.length,
		})
		state.queue = []
		this.setStatus(state, "interrupted")
		state.abortReason = "interrupt"
		if (state.abortController && !state.abortController.signal.aborted) {
			state.abortController.abort()
			return state
		}
		return state
	}

	async resume(agentId: string) {
		const state = this.agents.get(agentId)
		if (!state) {
			return undefined
		}
		if (state.status !== "shutdown") {
			return state
		}
		this.bump("resumes")
		this.log("resume", agentId)
		this.setStatus(state, "completed")
		void this.ensureRunning(state)
		return state
	}

	getMetrics() {
		return { ...this.metrics }
	}

	getRecentLogs(limit = 25) {
		if (limit <= 0) {
			return []
		}
		return this.logs.slice(-limit)
	}

	getStatus(agentId: string) {
		const state = this.agents.get(agentId)
		if (!state) {
			return {
				id: agentId,
				status: "not_found" as const,
				runtimeId: this.runtimeId,
				resumableScope: "in_memory_runtime" as const,
			}
		}
		return {
			id: state.id,
			type: state.type,
			status: state.status,
			depth: state.depth,
			parentId: state.parentId,
			forkContext: state.forkContext,
			createdAt: state.createdAt,
			updatedAt: state.updatedAt,
			lastResponse: state.lastResponse,
			lastError: state.lastError,
			queueLength: state.queue.length,
			runtimeId: this.runtimeId,
			resumableScope: "in_memory_runtime" as const,
		}
	}
}

const SpawnInputSchema = z.object({
	type: z.string().default("coding-agent").describe("Subagent type to spawn."),
	prompt: z.string().describe("Initial prompt for the subagent."),
	fork_context: z
		.boolean()
		.default(false)
		.describe("When true, fork the parent context into subagent history."),
	parent_id: z.string().optional().describe("Optional parent subagent id for nested delegation."),
})

const SendInputSchema = z.object({
	id: z.string().describe("Subagent id to send input to."),
	prompt: z.string().describe("Follow-up prompt for the subagent."),
})

const WaitSchema = z.object({
	ids: z.array(z.string()).min(1).describe("Subagent ids to wait for."),
	timeout_ms: z.number().int().positive().default(30_000).describe("Wait timeout in milliseconds."),
})

const CloseSchema = z.object({
	id: z.string().describe("Subagent id to close."),
})

const ResumeSchema = z.object({
	id: z.string().describe("Subagent id to resume."),
})

const InterruptSchema = z.object({
	id: z.string().describe("Subagent id to interrupt."),
})

export function createSubagentLifecycleTools(input: {
	runtime: SubagentRuntime
	currentAgentId?: string
	getParentMessages?: () => ModelMessage[]
	taskPermissions?: PermissionPatterns
	allowedSubagentTypes?: string[]
}) {
	const taskPermissions = input.taskPermissions ?? DEFAULT_TASK_PERMISSIONS
	const allowedSubagentTypes = input.allowedSubagentTypes
	const spawnAgent = tool({
		description: "Spawn a subagent with explicit lifecycle management and optional context fork.",
		inputSchema: SpawnInputSchema,
		needsApproval: ({ type }) => {
			const permission = checkPermission(type ?? "coding-agent", taskPermissions)
			return permission === "ask"
		},
		async *execute(params) {
			yield {
				status: "pending",
				message: "Spawning subagent...",
			}
			if (Array.isArray(allowedSubagentTypes) && !allowedSubagentTypes.includes(params.type)) {
				yield {
					status: "error",
					message: `Subagent type "${params.type}" is blocked by tool scope policy.`,
					error: `Subagent type "${params.type}" is not allowed in this agent scope.`,
					metrics: input.runtime.getMetrics(),
				}
				return
			}
			const permission = checkPermission(params.type, taskPermissions)
			if (permission === "deny") {
				yield {
					status: "error",
					message: `Task permission denied for subagent type "${params.type}".`,
					error: `Subagent type "${params.type}" is denied by permission.task policy.`,
					metrics: input.runtime.getMetrics(),
				}
				return
			}
			try {
				const state = await input.runtime.spawn({
					type: params.type,
					prompt: params.prompt,
					parentId: params.parent_id ?? input.currentAgentId,
					forkContext: params.fork_context,
					parentMessages: params.fork_context ? (input.getParentMessages?.() ?? []) : [],
				})
				yield {
					status: "success",
					message: `Spawned ${state.id}.`,
					agent: input.runtime.getStatus(state.id),
					metrics: input.runtime.getMetrics(),
				}
			} catch (error) {
				yield {
					status: "error",
					message: "Failed to spawn subagent.",
					error: error instanceof Error ? error.message : String(error),
					metrics: input.runtime.getMetrics(),
				}
			}
		},
	})

	const sendInput = tool({
		description: "Send follow-up input to an existing subagent.",
		inputSchema: SendInputSchema,
		async *execute(params) {
			yield {
				status: "pending",
				message: `Queueing follow-up for ${params.id}...`,
			}
			try {
				const state = await input.runtime.sendInput(params.id, params.prompt)
				if (!state) {
					throw new Error(`Subagent not found: ${params.id}`)
				}
				yield {
					status: "success",
					message: "Follow-up queued.",
					agent: input.runtime.getStatus(params.id),
					metrics: input.runtime.getMetrics(),
				}
			} catch (error) {
				yield {
					status: "error",
					message: "Failed to send input.",
					error: error instanceof Error ? error.message : String(error),
					metrics: input.runtime.getMetrics(),
				}
			}
		},
	})

	const waitForSubagents = tool({
		description:
			"Wait for one or more subagents to reach a final state (completed, errored, shutdown, or timeout).",
		inputSchema: WaitSchema,
		async *execute(params) {
			yield {
				status: "pending",
				message: "Waiting for subagents...",
			}
			try {
				const waitResult = await input.runtime.wait(params.ids, params.timeout_ms)
				yield {
					status: "success",
					message: waitResult.timedOut
						? "Wait timed out for one or more subagents."
						: "Wait completed.",
					...waitResult,
					metrics: input.runtime.getMetrics(),
				}
			} catch (error) {
				yield {
					status: "error",
					message: "Wait failed.",
					error: error instanceof Error ? error.message : String(error),
					metrics: input.runtime.getMetrics(),
				}
			}
		},
	})

	const closeSubagent = tool({
		description: "Close a subagent and release its active execution slot.",
		inputSchema: CloseSchema,
		async *execute(params) {
			yield { status: "pending", message: `Closing ${params.id}...` }
			try {
				const state = await input.runtime.close(params.id)
				if (!state) {
					throw new Error(`Subagent not found: ${params.id}`)
				}
				yield {
					status: "success",
					message: "Subagent closed.",
					agent: input.runtime.getStatus(params.id),
					metrics: input.runtime.getMetrics(),
				}
			} catch (error) {
				yield {
					status: "error",
					message: "Close failed.",
					error: error instanceof Error ? error.message : String(error),
					metrics: input.runtime.getMetrics(),
				}
			}
		},
	})

	const resumeSubagent = tool({
		description: "Resume a previously closed subagent session.",
		inputSchema: ResumeSchema,
		async *execute(params) {
			yield { status: "pending", message: `Resuming ${params.id}...` }
			try {
				const state = await input.runtime.resume(params.id)
				if (!state) {
					throw new Error(`Subagent not found: ${params.id}`)
				}
				yield {
					status: "success",
					message: "Subagent resumed.",
					agent: input.runtime.getStatus(params.id),
					metrics: input.runtime.getMetrics(),
				}
			} catch (error) {
				yield {
					status: "error",
					message: "Resume failed.",
					error: error instanceof Error ? error.message : String(error),
					metrics: input.runtime.getMetrics(),
				}
			}
		},
	})

	const interruptSubagent = tool({
		description:
			"Interrupt a running subagent and stop queued work without shutting down the session.",
		inputSchema: InterruptSchema,
		async *execute(params) {
			yield { status: "pending", message: `Interrupting ${params.id}...` }
			try {
				const state = await input.runtime.interrupt(params.id)
				if (!state) {
					throw new Error(`Subagent not found: ${params.id}`)
				}
				yield {
					status: "success",
					message: "Subagent interrupted.",
					agent: input.runtime.getStatus(params.id),
					metrics: input.runtime.getMetrics(),
				}
			} catch (error) {
				yield {
					status: "error",
					message: "Interrupt failed.",
					error: error instanceof Error ? error.message : String(error),
					metrics: input.runtime.getMetrics(),
				}
			}
		},
	})

	return {
		spawnAgent,
		sendInput,
		waitForSubagents,
		interruptSubagent,
		closeSubagent,
		resumeSubagent,
	}
}
