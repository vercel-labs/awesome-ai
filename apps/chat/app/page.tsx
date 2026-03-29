import { redirect } from "next/navigation"
import { ChatPageClient } from "@/components/chat/chat-page-client"
import { getAgents, getAllCategories } from "@/lib/agents"
import { isAuthenticated } from "@/lib/auth-server"

export default async function HomePage() {
	if (!(await isAuthenticated())) {
		redirect("/sign-in")
	}
	const agents = await getAgents()
	const categories = getAllCategories(agents)
	return <ChatPageClient agents={agents} categories={categories} />
}
