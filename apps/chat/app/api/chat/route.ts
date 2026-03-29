import { createAgentUIStreamResponse } from "ai"
import { z } from "zod"
import { createAgent as createCodingAgent } from "@/agents/coding-agent"
import { getAgents } from "@/lib/agents"
import { getChatModel } from "@/lib/ai"
import { isAuthenticated } from "@/lib/auth-server"

const messageSchema = z.object({
	id: z.string().optional(),
	role: z.enum(["system", "user", "assistant"]),
	parts: z.array(
		z.object({
			type: z.literal("text"),
			text: z.string(),
		}),
	),
	content: z.string().optional(),
})

const chatRequestSchema = z.object({
	messages: z.array(messageSchema).min(1),
	agentId: z.string().min(1),
	model: z.string().optional(),
})

export async function POST(request: Request) {
	try {
		if (!(await isAuthenticated())) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}
		const body = await request.json()
		const { messages, agentId, model } = chatRequestSchema.parse(body)

		const agents = await getAgents()
		const selectedAgent = agents.find((agent) => agent.name === agentId) ?? null
		if (!selectedAgent) {
			return Response.json(
				{
					error: "Unknown agent",
					agentId,
				},
				{ status: 404 },
			)
		}

		const normalizedMessages = messages.map((message) => {
			if (message.parts.length) {
				return message
			}

			return {
				...message,
				parts: [
					{
						type: "text" as const,
						text: message.content ?? "",
					},
				],
			}
		})

		const languageModel = getChatModel(model)
		if (agentId === "coding-agent") {
			const codingAgent = await createCodingAgent({
				model: languageModel,
				cwd: process.cwd(),
			})

			return await createAgentUIStreamResponse({
				agent: codingAgent,
				uiMessages: normalizedMessages,
				abortSignal: request.signal,
			})
		}

		return Response.json(
			{
				error: "Agent is not implemented in this API route",
				agentId,
			},
			{ status: 501 },
		)
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{
					error: "Invalid request payload",
					details: error.flatten(),
				},
				{ status: 400 },
			)
		}

		return Response.json(
			{
				error: "Failed to process chat request",
			},
			{ status: 500 },
		)
	}
}
