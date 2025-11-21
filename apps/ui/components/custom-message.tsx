"use client"

import type { UseChatHelpers } from "@ai-sdk/react"
import { motion } from "framer-motion"
import { useState } from "react"
import type { AgentMessage } from "@/lib/types"
import { cn, sanitizeText } from "@/lib/utils"
import { formatToolOutputForDisplay } from "@/lib/tool-utils"
import {
	Confirmation,
	ConfirmationAccepted,
	ConfirmationAction,
	ConfirmationActions,
	ConfirmationRejected,
	ConfirmationRequest,
	ConfirmationTitle,
} from "./elements/confirmation"
import { MessageContent } from "./elements/message"
import { Response } from "./elements/response"
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "./elements/tool"
import { SparklesIcon } from "./icons"
import { MessageActions } from "./message-actions"
import { MessageEditor } from "./message-editor"
import { MessageReasoning } from "./message-reasoning"

export const CustomMessage = ({
	message,
	isLoading = false,
	chatId,
	setMessages,
	regenerate,
	isReadonly,
	addToolApprovalResponse,
}: {
	message: AgentMessage
	isLoading?: boolean
	chatId: string
	setMessages?: UseChatHelpers<AgentMessage>["setMessages"]
	regenerate?: UseChatHelpers<AgentMessage>["regenerate"]
	isReadonly: boolean
	addToolApprovalResponse?: UseChatHelpers<AgentMessage>["addToolApprovalResponse"]
}) => {
	const { role } = message
	const [mode, setMode] = useState<"view" | "edit">("view")

	return (
		<motion.div
			animate={{ opacity: 1 }}
			className="group/message w-full"
			data-role={role}
			data-testid={`message-${role}`}
			initial={{ opacity: 0 }}
		>
			<div
				className={cn("flex w-full items-start gap-2 md:gap-3", {
					"justify-end": role === "user" && mode !== "edit",
					"justify-start": role === "assistant",
				})}
			>
				{role === "assistant" && (
					<div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
						<SparklesIcon size={14} />
					</div>
				)}

				<div
					className={cn("flex flex-col", {
						"gap-2 md:gap-4": message.parts?.some(
							(p) => p.type === "text" && p.text?.trim(),
						),
						"w-full": role === "assistant" || mode === "edit",
						"max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
							role === "user" && mode !== "edit",
					})}
				>
					{message.parts?.map((part, index) => {
						const { type } = part
						const key = `message-${message.id}-part-${index}`

						if (type === "reasoning" && part.text?.trim().length > 0) {
							return (
								<MessageReasoning
									isLoading={false}
									key={key}
									reasoning={part.text}
								/>
							)
						}

						if (type === "text") {
							if (mode === "view") {
								return (
									<div key={key}>
										<MessageContent
											className={cn({
												"w-fit break-words rounded-2xl px-3 py-2 text-right text-white":
													role === "user",
												"bg-transparent px-0 py-0 text-left":
													role === "assistant",
											})}
											data-testid="message-content"
											style={
												role === "user"
													? { backgroundColor: "#006cff" }
													: undefined
											}
										>
											<Response>{sanitizeText(part.text)}</Response>
										</MessageContent>
									</div>
								)
							}

							if (mode === "edit") {
								return (
									<div
										className="flex w-full flex-row items-start gap-3"
										key={key}
									>
										<div className="size-8" />
										<div className="min-w-0 flex-1">
											<MessageEditor
												key={message.id}
												message={message}
												regenerate={regenerate!}
												setMessages={setMessages!}
												setMode={setMode}
											/>
										</div>
									</div>
								)
							}
						}

						if (type === "tool-bash") {
							const { command, description } = part.input || {}

							return (
								<div
									className="mb-4 w-full overflow-hidden rounded-lg border bg-background"
									key={part.toolCallId}
								>
									{description && (
										<div className="border-b bg-muted/30 px-4 py-2">
											<p className="text-muted-foreground text-sm">
												{description}
											</p>
										</div>
									)}

									<div className="bg-[#1e1e1e] p-4 font-mono text-sm">
										<div className="flex items-start gap-2">
											<span className="text-muted-foreground select-none">
												$
											</span>
											<span className="text-[#d4d4d4] break-words">
												{command}
											</span>
										</div>
									</div>

									<Confirmation approval={part.approval} state={part.state}>
										<ConfirmationRequest>
											<ConfirmationTitle>
												This command requires approval before execution.
											</ConfirmationTitle>
											<ConfirmationActions>
												<ConfirmationAction
													onClick={() => {
														console.log("added approval", {
															id: part.approval!.id,
															approved: true,
														})
														addToolApprovalResponse?.({
															id: part.approval!.id,
															approved: true,
														})
													}}
												>
													Approve
												</ConfirmationAction>
												<ConfirmationAction
													onClick={() =>
														addToolApprovalResponse?.({
															id: part.approval!.id,
															approved: false,
														})
													}
													variant="destructive"
												>
													Deny
												</ConfirmationAction>
											</ConfirmationActions>
										</ConfirmationRequest>

										<ConfirmationAccepted>
											<ConfirmationTitle>
												Approved. Command execution will continue...
											</ConfirmationTitle>
										</ConfirmationAccepted>

										<ConfirmationRejected>
											<ConfirmationTitle>
												Denied. Command execution was cancelled.
											</ConfirmationTitle>
										</ConfirmationRejected>
									</Confirmation>

									{part.state === "output-available" && (
										<div className="border-t bg-[#1e1e1e] p-4 font-mono text-sm">
											<div className="text-[#d4d4d4] whitespace-pre-wrap break-words">
												{(() => {
													const toolPart = part as {
														errorText?: string
														output?: unknown
													}
													if (toolPart.errorText) {
														return (
															<div className="text-red-400">
																{toolPart.errorText}
															</div>
														)
													}
													if (toolPart.output) {
														return typeof toolPart.output === "string"
															? toolPart.output
															: JSON.stringify(toolPart.output, null, 2)
													}
													return null
												})()}
											</div>
										</div>
									)}

									{part.state === "output-denied" && (
										<div className="border-t bg-[#1e1e1e] p-4 font-mono text-sm">
											<div className="text-orange-400">
												Command execution was denied by user
											</div>
										</div>
									)}
								</div>
							)
						}

						// Handle other tool parts (tool-read, tool-write, tool-edit, etc.)
						if (type.startsWith("tool-") && "toolCallId" in part) {
							return (
								<Tool key={part.toolCallId} defaultOpen={false}>
									<ToolHeader
										state={part.state}
										type={type as `tool-${string}`}
									/>
									<ToolContent>
										{(part.state === "input-available" ||
											part.state === "approval-requested") &&
										part.input ? (
											<ToolInput input={part.input} />
										) : null}

										<Confirmation approval={part.approval} state={part.state}>
											<ConfirmationRequest>
												<ConfirmationTitle>
													This tool requires approval before execution.
												</ConfirmationTitle>
												<ConfirmationActions>
													<ConfirmationAction
														onClick={() =>
															addToolApprovalResponse?.({
																id: part.approval!.id,
																approved: true,
															})
														}
													>
														Approve
													</ConfirmationAction>
													<ConfirmationAction
														onClick={() =>
															addToolApprovalResponse?.({
																id: part.approval!.id,
																approved: false,
															})
														}
														variant="destructive"
													>
														Deny
													</ConfirmationAction>
												</ConfirmationActions>
											</ConfirmationRequest>

											<ConfirmationAccepted>
												<ConfirmationTitle>
													Approved. Tool execution will continue...
												</ConfirmationTitle>
											</ConfirmationAccepted>

											<ConfirmationRejected>
												<ConfirmationTitle>
													Denied. Tool execution was cancelled.
												</ConfirmationTitle>
											</ConfirmationRejected>
										</Confirmation>

										{part.state === "output-available" && (
											<ToolOutput
												errorText={part.errorText}
												output={formatToolOutputForDisplay(
													part.output,
													type as `tool-${string}`,
												)}
											/>
										)}

										{part.state === "output-denied" && (
											<ToolOutput
												errorText="Tool execution was denied by user"
												output={undefined}
											/>
										)}
									</ToolContent>
								</Tool>
							)
						}

						return null
					})}

					{!isReadonly && (
						<MessageActions
							chatId={chatId}
							isLoading={isLoading}
							isReadonly={isReadonly}
							key={`action-${message.id}`}
							message={message}
							setMode={setMode}
						/>
					)}
				</div>
			</div>
		</motion.div>
	)
}

export const ThinkingMessage = () => {
	const role = "assistant"

	return (
		<motion.div
			animate={{ opacity: 1 }}
			className="group/message w-full"
			data-role={role}
			data-testid="message-assistant-loading"
			exit={{ opacity: 0, transition: { duration: 0.5 } }}
			initial={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
		>
			<div className="flex items-start justify-start gap-3">
				<div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
					<SparklesIcon size={14} />
				</div>

				<div className="flex w-full flex-col gap-2 md:gap-4">
					<div className="p-0 text-muted-foreground text-sm">Thinking...</div>
				</div>
			</div>
		</motion.div>
	)
}
