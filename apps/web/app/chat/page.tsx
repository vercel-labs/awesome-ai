import { ChatPageClient } from "@/components/chat/chat-page-client"
import { getAllAgents, getAllCategories } from "@/lib/agents"

export default async function ChatPage() {
	const [agents, categories] = await Promise.all([
		getAllAgents(),
		getAllCategories(),
	])

	return <ChatPageClient agents={agents} categories={categories} />
}
