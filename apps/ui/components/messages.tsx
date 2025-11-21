"use client"

import type { UseChatHelpers } from "@ai-sdk/react"
import { AnimatePresence } from "framer-motion"
import type { AgentMessage } from "@/lib/types"
import { CustomMessage, ThinkingMessage } from "./custom-message"
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "./elements/conversation"
import { Greeting } from "./greeting"

type MessagesProps = {
	chatId: string
	status: UseChatHelpers<AgentMessage>["status"]
	messages: AgentMessage[]
	isReadonly: boolean
	setMessages: UseChatHelpers<AgentMessage>["setMessages"]
	regenerate: UseChatHelpers<AgentMessage>["regenerate"]
	addToolApprovalResponse: UseChatHelpers<AgentMessage>["addToolApprovalResponse"]
}

export function Messages({
	chatId,
	status,
	messages,
	isReadonly,
	setMessages,
	regenerate,
	addToolApprovalResponse,
}: MessagesProps) {
	return (
		<Conversation className="overscroll-behavior-contain -webkit-overflow-scrolling-touch flex-1 touch-pan-y">
			<ConversationContent className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 px-2 py-4 md:gap-6 md:px-4">
				{messages.length === 0 && <Greeting />}

				{messages.map((message, index) => (
					<CustomMessage
						chatId={chatId}
						isLoading={status === "streaming" && messages.length - 1 === index}
						isReadonly={isReadonly}
						key={message.id}
						message={message}
						regenerate={regenerate}
						setMessages={setMessages}
						addToolApprovalResponse={addToolApprovalResponse}
					/>
				))}

				<AnimatePresence mode="wait">
					{status === "submitted" && <ThinkingMessage key="thinking" />}
				</AnimatePresence>

				<div className="min-h-[24px] min-w-[24px] shrink-0" />
			</ConversationContent>

			<ConversationScrollButton />
		</Conversation>
	)
}
