export interface Message {
	id: string
	role: "user" | "assistant"
	content: string
	timestamp: Date
	status?: "streaming" | "done" | "error"
}

export interface Chat {
	id: string
	title: string
	agentId: string
	messages: Message[]
	createdAt: Date
	updatedAt: Date
}
