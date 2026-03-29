"use client"

import { Send, Terminal, User } from "lucide-react"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import type { Agent } from "@/lib/agents"
import type { Message } from "@/lib/chat"
import { cn } from "@/lib/utils"

interface ChatAreaProps {
	agent: Agent | null
	messages: Message[]
	isLoading: boolean
	errorMessage?: string | null
	onSendMessage: (content: string) => Promise<void>
	onStopGeneration: () => void
	onRetry: () => void
}

export function ChatArea({
	agent,
	messages,
	isLoading,
	errorMessage,
	onSendMessage,
	onStopGeneration,
	onRetry,
}: ChatAreaProps) {
	const [input, setInput] = useState("")
	const scrollRef = useRef<HTMLDivElement>(null)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight
		}
	}, [messages])

	const submitMessage = async () => {
		if (!input.trim() || !agent || isLoading) return
		await onSendMessage(input.trim())
		setInput("")
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		await submitMessage()
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			void submitMessage()
		}
	}

	if (!agent) {
		return (
			<div className="flex-1 flex items-center justify-center bg-background">
				<div className="text-center">
					<Terminal className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
					<h2 className="text-lg font-medium text-foreground mb-2">Select an agent to start</h2>
					<p className="text-sm text-muted-foreground">Choose an agent from the left sidebar</p>
				</div>
			</div>
		)
	}

	return (
		<div className="flex-1 flex flex-col bg-background h-full">
			{/* Header */}
			<div className="p-4 border-b border-border bg-card">
				<div className="flex items-center gap-3">
					<div className="p-2 rounded bg-primary/10 border border-primary/30">
						<Terminal className="h-4 w-4 text-primary" />
					</div>
					<div>
						<h2 className="font-medium text-foreground">{agent.title}</h2>
						<p className="text-xs text-muted-foreground">{agent.categories.join(", ")}</p>
					</div>
				</div>
			</div>

			{/* Messages */}
			<ScrollArea className="flex-1 p-4" ref={scrollRef}>
				{messages.length === 0 ? (
					<div className="h-full flex items-center justify-center">
						<div className="text-center max-w-md">
							<div className="p-4 rounded border border-dashed border-border mb-4">
								<code className="text-sm text-primary">$ awesome-ai chat {agent.name}</code>
							</div>
							<p className="text-sm text-muted-foreground">
								Start a conversation with {agent.title}. This agent specializes in{" "}
								{agent.categories.join(", ")}.
							</p>
						</div>
					</div>
				) : (
					<div className="space-y-4">
						{messages.map((message) => (
							<div
								key={message.id}
								className={cn("flex gap-3", message.role === "user" && "justify-end")}
							>
								{message.role === "assistant" && (
									<div className="p-2 rounded bg-primary/10 border border-primary/30 h-fit">
										<Terminal className="h-4 w-4 text-primary" />
									</div>
								)}
								<div
									className={cn(
										"max-w-[70%] p-3 rounded",
										message.role === "assistant"
											? "bg-card border border-border"
											: "bg-primary text-primary-foreground",
									)}
								>
									<p className="text-sm whitespace-pre-wrap">{message.content}</p>
									<p
										className={cn(
											"text-xs mt-2",
											message.role === "assistant"
												? "text-muted-foreground"
												: "text-primary-foreground/70",
										)}
									>
										{message.timestamp.toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</p>
								</div>
								{message.role === "user" && (
									<div className="p-2 rounded bg-secondary h-fit">
										<User className="h-4 w-4 text-foreground" />
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</ScrollArea>

			{/* Input */}
			<div className="p-4 border-t border-border bg-card">
				{errorMessage && (
					<div className="mb-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive flex items-center justify-between gap-2">
						<span>{errorMessage}</span>
						<Button size="sm" variant="ghost" onClick={onRetry}>
							Retry
						</Button>
					</div>
				)}
				<form onSubmit={handleSubmit} className="flex gap-2">
					<div className="flex-1 relative">
						<span className="absolute left-3 top-3 text-primary">{">"}</span>
						<Textarea
							ref={textareaRef}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder={`Message ${agent.title}...`}
							className="pl-7 min-h-[44px] max-h-32 resize-none bg-secondary"
							disabled={isLoading}
							rows={1}
						/>
					</div>
					{isLoading ? (
						<Button
							type="button"
							variant="secondary"
							onClick={onStopGeneration}
							className="self-end"
						>
							Stop
						</Button>
					) : (
						<Button type="submit" disabled={!input.trim()} className="self-end">
							<Send className="h-4 w-4" />
						</Button>
					)}
				</form>
				<p className="text-xs text-muted-foreground mt-2">
					Press Enter to send, Shift+Enter for new line
				</p>
			</div>
		</div>
	)
}
