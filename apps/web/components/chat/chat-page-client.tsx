"use client"

import { ArrowLeft, Terminal } from "lucide-react"
import Link from "next/link"
import { useCallback, useState } from "react"
import { AgentSidebar } from "@/components/chat/agent-sidebar"
import { ChatArea } from "@/components/chat/chat-area"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { Button } from "@/components/ui/button"
import type { Agent } from "@/lib/agents"
import { type Chat, type Message, mockChats } from "@/lib/chat"

interface ChatPageClientProps {
	agents: Agent[]
	categories: string[]
}

export function ChatPageClient({ agents, categories }: ChatPageClientProps) {
	const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
	const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
	const [chats, setChats] = useState<Chat[]>(mockChats)
	const [messages, setMessages] = useState<Message[]>([])

	const handleSelectAgent = useCallback(
		(agent: Agent) => {
			setSelectedAgent(agent)
			if (selectedChat && selectedChat.agentId === agent.name) {
				return
			}
			setSelectedChat(null)
			setMessages([])
		},
		[selectedChat],
	)

	const handleSelectChat = useCallback(
		(chat: Chat) => {
			setSelectedChat(chat)
			setMessages(chat.messages)
			const agent = agents.find((a) => a.name === chat.agentId)
			if (agent) {
				setSelectedAgent(agent)
			}
		},
		[agents],
	)

	const handleNewChat = useCallback(() => {
		setSelectedChat(null)
		setMessages([])
	}, [])

	const handleDeleteChat = useCallback(
		(chatId: string) => {
			setChats((prev) => prev.filter((c) => c.id !== chatId))
			if (selectedChat?.id === chatId) {
				setSelectedChat(null)
				setMessages([])
			}
		},
		[selectedChat],
	)

	const handleSendMessage = useCallback(
		(content: string) => {
			if (!selectedAgent) return

			const userMessage: Message = {
				id: `m-${Date.now()}`,
				role: "user",
				content,
				timestamp: new Date(),
			}

			const newMessages = [...messages, userMessage]
			setMessages(newMessages)

			// Simulate assistant response
			setTimeout(() => {
				const assistantMessage: Message = {
					id: `m-${Date.now() + 1}`,
					role: "assistant",
					content: `[${selectedAgent.title}] I received your message: "${content}"\n\nThis is a demo response. In a real implementation, this would connect to an AI backend.`,
					timestamp: new Date(),
				}

				setMessages((prev) => [...prev, assistantMessage])

				if (!selectedChat) {
					const newChat: Chat = {
						id: `chat-${Date.now()}`,
						title: content.slice(0, 30) + (content.length > 30 ? "..." : ""),
						agentId: selectedAgent.name,
						messages: [...newMessages, assistantMessage],
						createdAt: new Date(),
						updatedAt: new Date(),
					}
					setChats((prev) => [newChat, ...prev])
					setSelectedChat(newChat)
				} else {
					setChats((prev) =>
						prev.map((c) =>
							c.id === selectedChat.id
								? {
										...c,
										messages: [...newMessages, assistantMessage],
										updatedAt: new Date(),
									}
								: c,
						),
					)
				}
			}, 500)
		},
		[selectedAgent, messages, selectedChat],
	)

	const filteredChats = selectedAgent
		? chats.filter((c) => c.agentId === selectedAgent.name)
		: chats

	return (
		<div className="h-screen flex flex-col bg-background">
			{/* Header */}
			<header className="border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
				<div className="px-4 py-3 flex items-center justify-between">
					<div className="flex items-center gap-4">
						<Button variant="ghost" size="sm" asChild>
							<Link href="/">
								<ArrowLeft className="h-4 w-4" />
								Back
							</Link>
						</Button>
						<div className="flex items-center gap-2">
							<div className="p-1.5 rounded bg-primary/10 border border-primary/30">
								<Terminal className="h-4 w-4 text-primary" />
							</div>
							<span className="font-semibold text-foreground">
								awesome-ai chat
							</span>
						</div>
					</div>
					<code className="text-xs text-muted-foreground hidden sm:block">
						$ awesome-ai chat --interactive
					</code>
				</div>
			</header>

			{/* Main Content */}
			<div className="flex-1 flex overflow-hidden">
				<AgentSidebar
					agents={agents}
					categories={categories}
					selectedAgent={selectedAgent}
					onSelectAgent={handleSelectAgent}
				/>
				<ChatArea
					agent={selectedAgent}
					messages={messages}
					onSendMessage={handleSendMessage}
				/>
				<ChatSidebar
					chats={filteredChats}
					selectedChat={selectedChat}
					onSelectChat={handleSelectChat}
					onNewChat={handleNewChat}
					onDeleteChat={handleDeleteChat}
				/>
			</div>
		</div>
	)
}
