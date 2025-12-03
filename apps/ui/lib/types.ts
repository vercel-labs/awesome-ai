import type { InferUITool, UIMessage } from "ai"
import { z } from "zod"
import { bashTool } from "@/tools/bash"
import { editTool } from "@/tools/edit"
import { globTool } from "@/tools/glob"
import { grepTool } from "@/tools/grep"
import { listTool } from "@/tools/list"
import { readTool } from "@/tools/read"
import { writeTool } from "@/tools/write"

// Message metadata
export const messageMetadataSchema = z.object({
	chatId: z.string(),
	userMessageId: z.string().optional(),
	createdAt: z.string().optional(),
})

export type MessageMetadata = z.infer<typeof messageMetadataSchema>

// Tools object for type inference
const tools = {
	read: readTool,
	write: writeTool,
	edit: editTool,
	bash: bashTool,
	list: listTool,
	grep: grepTool,
	glob: globTool,
}

// Infer tool types from agent tools
type ReadTool = InferUITool<(typeof tools)["read"]>
type WriteTool = InferUITool<(typeof tools)["write"]>
type EditTool = InferUITool<(typeof tools)["edit"]>
type BashTool = InferUITool<(typeof tools)["bash"]>
type ListTool = InferUITool<(typeof tools)["list"]>
type GrepTool = InferUITool<(typeof tools)["grep"]>
type GlobTool = InferUITool<(typeof tools)["glob"]>

export type AgentTools = {
	read: ReadTool
	write: WriteTool
	edit: EditTool
	bash: BashTool
	list: ListTool
	grep: GrepTool
	glob: GlobTool
}

// Custom data types for agent-specific stream data
// Add custom data types here as needed (e.g., usage, textDelta, etc.)
export type AgentDataTypes = Record<string, never>

// Main message type for our agent UI
export type AgentMessage = UIMessage<
	MessageMetadata,
	AgentDataTypes,
	AgentTools
>

export interface Chat {
	id: string
	title?: string
	updatedAt: number
}

export type ChatHistory = {
	chats: Chat[]
	hasMore: boolean
}
