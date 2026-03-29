"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useMutation, useQuery } from "convex/react"
import { Terminal } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AgentSidebar } from "@/components/chat/agent-sidebar"
import { ChatArea } from "@/components/chat/chat-area"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { Agent } from "@/lib/agents"
import type { Chat, Message } from "@/lib/chat"

interface ChatPageClientProps {
	agents: Agent[]
	categories: string[]
}

type ChatId = Id<"chats"> | string

export function ChatPageClient({ agents, categories }: ChatPageClientProps) {
	const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
	const [selectedChatId, setSelectedChatId] = useState<ChatId | null>(null)
	const hydratedChatIdRef = useRef<ChatId | null>(null)
	const activeChatIdRef = useRef<ChatId | null>(null)

	const createChat = useMutation(api.chat.createChat)
	const appendMessage = useMutation(api.chat.appendMessage)
	const deleteChat = useMutation(api.chat.deleteChat)

	const chatRecords = useQuery(api.chat.listChats, {
		agentId: selectedAgent?.name,
	})
	const messageRecords = useQuery(
		api.chat.listMessages,
		selectedChatId ? { chatId: selectedChatId as Id<"chats"> } : "skip",
	)

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/chat",
				body: {
					agentId: selectedAgent?.name ?? "",
				},
			}),
		[selectedAgent?.name],
	)

	const {
		messages: uiMessages,
		setMessages,
		sendMessage,
		regenerate,
		stop,
		status,
		error,
		clearError,
	} = useChat({
		transport,
		onFinish: async ({ message, isError }) => {
			const chatId = activeChatIdRef.current
			if (!chatId || isError) return

			const content = extractText(message.parts)
			if (!content.trim()) return
			const timestamp = Date.now()

			setMessages((currentMessages) =>
				currentMessages.map((currentMessage) =>
					currentMessage.id === message.id
						? {
								...currentMessage,
								metadata: {
									...(typeof currentMessage.metadata === "object" &&
									currentMessage.metadata !== null
										? currentMessage.metadata
										: {}),
									timestamp,
								},
							}
						: currentMessage,
				),
			)

			await appendMessage({
				chatId: chatId as Id<"chats">,
				role: "assistant",
				content,
			})
		},
	})

	useEffect(() => {
		activeChatIdRef.current = selectedChatId
	}, [selectedChatId])

	useEffect(() => {
		if (!selectedChatId) {
			hydratedChatIdRef.current = null
			setMessages([])
			return
		}

		if (!messageRecords) return
		if (hydratedChatIdRef.current === selectedChatId) return

		setMessages(toUiMessages(messageRecords))
		hydratedChatIdRef.current = selectedChatId
	}, [messageRecords, selectedChatId, setMessages])

	const chats = useMemo(() => toChatList(chatRecords ?? []), [chatRecords])
	const selectedChat = useMemo(
		() => chats.find((chat) => chat.id === (selectedChatId ? String(selectedChatId) : "")) ?? null,
		[chats, selectedChatId],
	)
	const messages = useMemo(() => toMessageList(uiMessages), [uiMessages])

	const handleSelectAgent = useCallback(
		(agent: Agent) => {
			setSelectedAgent(agent)
			if (selectedChat && selectedChat.agentId === agent.name) {
				return
			}
			setSelectedChatId(null)
			setMessages([])
			hydratedChatIdRef.current = null
		},
		[selectedChat, setMessages],
	)

	const handleSelectChat = useCallback(
		(chat: Chat) => {
			setSelectedChatId(chat.id as Id<"chats">)
			hydratedChatIdRef.current = null
			const agent = agents.find((a) => a.name === chat.agentId)
			if (agent) {
				setSelectedAgent(agent)
			}
		},
		[agents],
	)

	const handleNewChat = useCallback(() => {
		setSelectedChatId(null)
		setMessages([])
		hydratedChatIdRef.current = null
		clearError()
	}, [clearError, setMessages])

	const handleDeleteChat = useCallback(
		async (chatId: string) => {
			const typedChatId = chatId as ChatId
			await deleteChat({ chatId: typedChatId as Id<"chats"> })
			if (selectedChatId === typedChatId) {
				setSelectedChatId(null)
				setMessages([])
				hydratedChatIdRef.current = null
			}
		},
		[deleteChat, selectedChatId, setMessages],
	)

	const handleSendMessage = useCallback(
		async (content: string) => {
			if (!selectedAgent) return

			clearError()

			let chatId = selectedChatId
			if (!chatId) {
				chatId = await createChat({
					agentId: selectedAgent.name,
					title: content.slice(0, 40) + (content.length > 40 ? "..." : ""),
				})
				setSelectedChatId(chatId)
				hydratedChatIdRef.current = chatId
				setMessages([])
			}

			activeChatIdRef.current = chatId

			await appendMessage({
				chatId: chatId as Id<"chats">,
				role: "user",
				content,
			})

			await sendMessage({
				text: content,
				metadata: {
					timestamp: Date.now(),
				},
			})
		},
		[
			appendMessage,
			clearError,
			createChat,
			selectedAgent,
			selectedChatId,
			sendMessage,
			setMessages,
		],
	)

	const handleRetry = useCallback(() => {
		void regenerate()
	}, [regenerate])

	const handleStopGeneration = useCallback(() => {
		void stop()
	}, [stop])

	return (
		<div className="h-screen flex flex-col bg-background">
			{/* Header */}
			<header className="border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
				<div className="px-4 py-3 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="p-1.5 rounded bg-primary/10 border border-primary/30">
							<Terminal className="h-4 w-4 text-primary" />
						</div>
						<span className="font-semibold text-foreground">awesome-ai chat</span>
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
					isLoading={status === "submitted" || status === "streaming"}
					errorMessage={error?.message}
					onSendMessage={handleSendMessage}
					onStopGeneration={handleStopGeneration}
					onRetry={handleRetry}
				/>
				<ChatSidebar
					chats={chats}
					selectedChat={selectedChat}
					onSelectChat={handleSelectChat}
					onNewChat={handleNewChat}
					onDeleteChat={handleDeleteChat}
				/>
			</div>
		</div>
	)
}

function extractText(parts: UIMessage["parts"]) {
	return parts
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("")
}

function toChatList(
	records: Array<{
		_id: string | Id<"chats">
		agentId: string
		title: string
		createdAt: number
		updatedAt: number
	}>,
): Chat[] {
	return records.map((record) => ({
		id: String(record._id),
		title: record.title,
		agentId: record.agentId,
		messages: [],
		createdAt: new Date(record.createdAt),
		updatedAt: new Date(record.updatedAt),
	}))
}

function toUiMessages(
	records: Array<{
		_id: string | Id<"messages">
		role: "user" | "assistant"
		content: string
		createdAt: number
	}>,
): UIMessage[] {
	return records.map((message) => ({
		id: String(message._id),
		role: message.role,
		metadata: {
			timestamp: message.createdAt,
		},
		parts: [
			{
				type: "text",
				text: message.content,
			},
		],
	}))
}

function toMessageList(messages: UIMessage[]): Message[] {
	return messages.filter(isUserOrAssistantMessage).map((message) => {
		const timestamp = readTimestamp(message)
		const isStreaming = message.parts.some(
			(part) => part.type === "text" && part.state === "streaming",
		)
		return {
			id: message.id,
			role: message.role,
			content: extractText(message.parts),
			timestamp: new Date(timestamp),
			status: isStreaming ? "streaming" : "done",
		}
	})
}

function isUserOrAssistantMessage(
	message: UIMessage,
): message is UIMessage & { role: "user" | "assistant" } {
	return message.role === "user" || message.role === "assistant"
}

function readTimestamp(message: UIMessage) {
	const metadata = message.metadata as { timestamp?: unknown } | undefined
	if (metadata && typeof metadata.timestamp === "number") {
		return metadata.timestamp
	}
	return Date.now()
}
