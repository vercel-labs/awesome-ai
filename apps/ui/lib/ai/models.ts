export const DEFAULT_CHAT_MODEL = "anthropic/claude-sonnet-4.5"

export type ChatModel = {
	id: string
	name: string
	description: string
	provider: string
}

export const chatModels: ChatModel[] = [
	{
		id: "anthropic/claude-sonnet-4.5",
		name: "Claude Sonnet 4.5",
		description:
			"Anthropic's most intelligent model with strong reasoning capabilities",
		provider: "anthropic",
	},
	{
		id: "anthropic/claude-3-5-sonnet-20241022",
		name: "Claude 3.5 Sonnet",
		description: "Fast and efficient for most tasks",
		provider: "anthropic",
	},
	{
		id: "openai/gpt-4o",
		name: "GPT-4o",
		description: "OpenAI's high-intelligence flagship model",
		provider: "openai",
	},
	{
		id: "openai/gpt-4o-mini",
		name: "GPT-4o mini",
		description: "Fast and affordable small model",
		provider: "openai",
	},
	{
		id: "openai/gpt-5",
		name: "GPT-5",
		description: "OpenAI's most advanced model with extended reasoning",
		provider: "openai",
	},
]
