import { AppSidebar } from "@/components/app-sidebar"
import { Chat } from "@/components/chat"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { generateId } from "@/lib/storage/utils"

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
