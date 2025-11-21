import { generateId } from "coding-agent"
import { AppSidebar } from "@/components/app-sidebar"
import { Chat } from "@/components/chat"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function Home() {
	const chatId = generateId()

	return (
		<SidebarProvider defaultOpen={false}>
			<AppSidebar />
			<SidebarInset>
				<Chat id={chatId} />
			</SidebarInset>
		</SidebarProvider>
	)
}
