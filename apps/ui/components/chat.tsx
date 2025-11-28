"use client"

import { useChat } from "@ai-sdk/react"
import {
	DefaultChatTransport,
	lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai"
import { useEffect, useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { unstable_serialize } from "swr/infinite"
import { ChatHeader } from "@/components/chat-header"
import { Messages } from "@/components/messages"
import { MultimodalInput } from "@/components/multimodal-input"
import { getChatHistoryPaginationKey } from "@/components/sidebar-history"
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models"
import type { AgentMessage } from "@/lib/types"

export function Chat({
	id,
	initialMessages = [],
	initialChatModel = DEFAULT_CHAT_MODEL,
}: {
	id: string
	initialMessages?: AgentMessage[]
	initialChatModel?: string
}) {
	const { mutate } = useSWRConfig()

	const [input, setInput] = useState<string>("")
	const [currentModelId, setCurrentModelId] = useState(initialChatModel)
	const currentModelIdRef = useRef(currentModelId)

	useEffect(() => {
		currentModelIdRef.current = currentModelId
	}, [currentModelId])

	const {
		messages,
		sendMessage,
		addToolApprovalResponse,
		status,
		stop,
		setMessages,
		regenerate,
	} = useChat({
		id,
		messages: initialMessages,
		transport: new DefaultChatTransport({
			api: "/api/agent",
			prepareSendMessagesRequest(request) {
				return {
					body: {
						...request.body,
						id: request.id,
						messages: request.messages,
						selectedChatModel: currentModelIdRef.current,
						chatId: id,
					},
				}
			},
		}),
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
		onFinish: ({ message }) => {
			// Mutate chat history to refresh sidebar
			mutate(unstable_serialize(getChatHistoryPaginationKey))

			// Update user message ID with server-provided ID
			if (message.metadata) {
				const metadata = message.metadata as {
					chatId?: string
					userMessageId?: string
				}

				// If server sent a userMessageId, update the user message
				if (metadata.userMessageId) {
					const serverUserId = metadata.userMessageId
					setMessages((currentMessages) => {
						// Find the user message (should be second-to-last, before the assistant message)
						const userMessageIndex = currentMessages.findIndex(
							(msg, idx) =>
								msg.role === "user" &&
								idx === currentMessages.length - 2 &&
								msg.id !== serverUserId,
						)

						if (userMessageIndex !== -1) {
							const updated = [...currentMessages]
							const userMessage = updated[userMessageIndex]
							if (userMessage) {
								updated[userMessageIndex] = {
									...userMessage,
									id: serverUserId,
								}
							}
							return updated
						}

						return currentMessages
					})
				}

				// Capture chatId if it changed
				if (metadata.chatId && metadata.chatId !== id) {
					console.log("Chat ID received:", metadata.chatId)
				}
			}
		},
	})
	const handleSendMessage = (text: string) => {
		sendMessage(
			{ role: "user", parts: [{ type: "text", text }] },
			{ body: { chatId: id } },
		)
		setInput("")
	}

	return (
		<div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
			<ChatHeader />

			<Messages
				chatId={id}
				messages={messages}
				status={status}
				isReadonly={false}
				setMessages={setMessages}
				regenerate={regenerate}
				addToolApprovalResponse={addToolApprovalResponse}
			/>

			<div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
				<MultimodalInput
					input={input}
					setInput={setInput}
					status={status}
					stop={stop}
					onSubmit={handleSendMessage}
					setMessages={setMessages}
					selectedModelId={currentModelId}
					onModelChange={setCurrentModelId}
				/>
			</div>
		</div>
	)
}
