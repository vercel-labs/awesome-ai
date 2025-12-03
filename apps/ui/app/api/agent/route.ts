import { gateway } from "@ai-sdk/gateway"
import { convertToModelMessages } from "ai"
import { createAgent } from "@/agents/coding-agent"
import { agentDB } from "@/lib/agent"
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models"
import { generateId } from "@/lib/storage/utils"
import type { AgentMessage } from "@/lib/types"

export async function POST(request: Request) {
	const body = (await request.json()) as {
		messages?: AgentMessage[]
		chatId?: string
		selectedChatModel?: string
	}
	const { messages: uiMessages, selectedChatModel = DEFAULT_CHAT_MODEL } = body
	let { chatId } = body

	// Validate that we have messages
	if (!uiMessages || !Array.isArray(uiMessages)) {
		return new Response(
			JSON.stringify({ error: "Invalid request: messages array required" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		)
	}

	const agent = await createAgent({ model: gateway(selectedChatModel) })
	const messages = convertToModelMessages(uiMessages, {
		tools: agent.tools,
	})

	if (!chatId) {
		const chat = await agentDB.createChat()
		chatId = chat.id
	}

	const lastUIMessage = uiMessages[uiMessages.length - 1]
	let userMessageId: string | undefined

	if (lastUIMessage && lastUIMessage.role === "user") {
		const savedUserMessage = await agentDB.saveMessage(chatId, lastUIMessage)
		userMessageId = savedUserMessage.id
	}

	const streamResult = await agent.stream({ messages })

	// Return the UI message stream response for the client
	// The onFinish callback saves the assistant message directly as UIMessage
	return streamResult.toUIMessageStreamResponse<AgentMessage>({
		originalMessages: uiMessages,
		generateMessageId: generateId,
		onFinish: async ({ responseMessage }) => {
			console.log("message", responseMessage)
			await agentDB.saveMessage(chatId, responseMessage)
		},
		messageMetadata: ({ part }) => {
			if (part.type === "start") {
				// Send both chatId and userMessageId so client can update its local message
				return { chatId, userMessageId }
			}
		},
	})
}
