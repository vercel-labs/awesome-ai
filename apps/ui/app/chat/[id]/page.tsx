import { notFound } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { Chat } from "@/components/chat"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { agentDB } from "@/lib/agent"
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models"
import { convertStoredMessagesToUIMessages } from "@/lib/utils"

export default async function ChatPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	const chat = await agentDB.getChat(id)

	if (!chat) notFound()

	const storedMessages = await agentDB.getMessages(id)
	const messages = convertStoredMessagesToUIMessages(storedMessages, id)

	return (
		<SidebarProvider defaultOpen={false}>
			<AppSidebar />
			<SidebarInset>
				<Chat
					id={id}
					initialMessages={messages}
					initialChatModel={DEFAULT_CHAT_MODEL}
				/>
			</SidebarInset>
		</SidebarProvider>
	)
}
