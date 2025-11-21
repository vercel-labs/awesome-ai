"use client"

import type { UseChatHelpers } from "@ai-sdk/react"
import { Trigger } from "@radix-ui/react-select"
import type { ChatStatus } from "ai"
import type { ChangeEvent } from "react"
import { memo, startTransition, useCallback, useEffect, useRef, useState } from "react"
import { SelectItem } from "@/components/ui/select"
import { chatModels } from "@/lib/ai/models"
import type { AgentMessage } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
	PromptInput,
	PromptInputModelSelect,
	PromptInputModelSelectContent,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
} from "./elements/prompt-input"
import { ArrowUpIcon, ChevronDownIcon, CpuIcon, StopIcon } from "./icons"
import { Button } from "./ui/button"

export function MultimodalInput({
	input,
	setInput,
	status,
	stop,
	onSubmit,
	className,
	setMessages,
	selectedModelId,
	onModelChange,
}: {
	input: string
	setInput: (value: string) => void
	status: ChatStatus
	stop: () => void
	onSubmit: (message: string) => void
	className?: string
	setMessages?: UseChatHelpers<AgentMessage>["setMessages"]
	selectedModelId: string
	onModelChange?: (modelId: string) => void
}) {
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	const handleInput = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setInput(event.target.value)
		},
		[setInput],
	)

	const submitForm = useCallback(() => {
		if (input.trim() === "") {
			return
		}

		onSubmit(input)
		setInput("")

		if (textareaRef.current) {
			textareaRef.current.style.height = "44px"
		}
	}, [input, onSubmit, setInput])

	const handleFormSubmit = useCallback(
		(event: React.FormEvent<HTMLFormElement>) => {
			event.preventDefault()

			if (status === "streaming") {
				stop()
				return
			}

			submitForm()
		},
		[status, stop, submitForm],
	)

	useEffect(() => {
		if (status === "ready") {
			textareaRef.current?.focus()
		}
	}, [status])

	return (
		<PromptInput
			className={cn(
				"rounded-xl border border-border bg-background p-3 shadow-xs transition-all duration-200 focus-within:border-border hover:border-muted-foreground/50",
				className,
			)}
			onSubmit={handleFormSubmit}
		>
			<div className="flex flex-row items-start gap-1 sm:gap-2">
				<PromptInputTextarea
					className="grow resize-none border-0! border-none! bg-transparent p-2 text-sm outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden"
					autoFocus
					disableAutoResize={true}
					maxHeight={200}
					minHeight={44}
					onChange={handleInput}
					placeholder="Send a message..."
					ref={textareaRef}
					rows={1}
					value={input}
				/>
			</div>
		<PromptInputToolbar className="!border-top-0 border-t-0! p-0 shadow-none dark:border-0 dark:border-transparent!">
			<PromptInputTools className="gap-0 sm:gap-0.5">
				<ModelSelectorCompact
					onModelChange={onModelChange}
					selectedModelId={selectedModelId}
				/>
			</PromptInputTools>

			{status === "submitted" ? (
				<Button
					className="size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
					data-testid="stop-button"
					onClick={(event) => {
						event.preventDefault()
						stop()
						setMessages?.((messages) => messages)
					}}
				>
					<StopIcon size={14} />
				</Button>
			) : (
				<PromptInputSubmit
					className="size-8 rounded-full bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
					disabled={input.trim() === ""}
					status={status}
				>
					<ArrowUpIcon size={14} />
				</PromptInputSubmit>
			)}
		</PromptInputToolbar>
	</PromptInput>
	)
}

function PureModelSelectorCompact({
	selectedModelId,
	onModelChange,
}: {
	selectedModelId: string
	onModelChange?: (modelId: string) => void
}) {
	const [optimisticModelId, setOptimisticModelId] = useState(selectedModelId)

	useEffect(() => {
		setOptimisticModelId(selectedModelId)
	}, [selectedModelId])

	const selectedModel = chatModels.find(
		(model) => model.id === optimisticModelId,
	)

	return (
		<PromptInputModelSelect
			onValueChange={(modelName) => {
				const model = chatModels.find((m) => m.name === modelName)
				if (model) {
					setOptimisticModelId(model.id)
					onModelChange?.(model.id)
					startTransition(() => {
						// Save model preference if needed
					})
				}
			}}
			value={selectedModel?.name}
		>
			<Trigger
				className="flex h-8 items-center gap-2 rounded-lg border-0 bg-background px-2 text-foreground shadow-none transition-colors hover:bg-accent focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
				type="button"
			>
				<CpuIcon size={16} />
				<span className="hidden font-medium text-xs sm:block">
					{selectedModel?.name}
				</span>
				<ChevronDownIcon size={16} />
			</Trigger>
			<PromptInputModelSelectContent className="min-w-[260px] p-0">
				<div className="flex flex-col gap-px">
					{chatModels.map((model) => (
						<SelectItem key={model.id} value={model.name}>
							<div className="truncate font-medium text-xs">{model.name}</div>
							<div className="mt-px truncate text-[10px] text-muted-foreground leading-tight">
								{model.description}
							</div>
						</SelectItem>
					))}
				</div>
			</PromptInputModelSelectContent>
		</PromptInputModelSelect>
	)
}

const ModelSelectorCompact = memo(PureModelSelectorCompact)
