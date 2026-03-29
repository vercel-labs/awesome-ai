import { ChatPageClient } from "@/components/chat/chat-page-client"
import { getAgents, getAllCategories } from "@/lib/agents"

export default async function HomePage() {
	const agents = await getAgents()
	const categories = getAllCategories(agents)
	return <ChatPageClient agents={agents} categories={categories} />
}
