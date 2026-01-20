import { useAtom } from "@lfades/atom"
import { colors } from "../theme"
import { formatTimestamp, getMessageText } from "../types"
import { type MessageAtom, useAppAtoms, useMessages } from "./atoms"
import { Markdown } from "./markdown"
import { ThinkingSection } from "./thinking-section"
import { type ToolData, ToolPart } from "./tool-part"
import { AnimatedDots } from "./ui/animated-dots"
import { ThinkingDots } from "./ui/thinking-dots"

function isToolPart(part: { type: string }): boolean {
	return part.type.startsWith("tool-") || part.type === "dynamic-tool"
}

function hasContent(msg: {
	parts: Array<{ type: string; text?: string }>
}): boolean {
	return msg.parts.some(
		(p) =>
			(p.type === "text" && p.text) ||
			(p.type === "reasoning" && p.text) ||
			isToolPart(p),
	)
}

function Message({ messageAtom }: { messageAtom: MessageAtom }) {
	const [msg] = useAtom(messageAtom)
	const text = getMessageText(msg)
	const streaming = msg.metadata?.streaming
	const timestamp = msg.metadata?.timestamp
		? formatTimestamp(msg.metadata.timestamp)
		: ""
	const showThinking = streaming && !hasContent(msg)

	return (
		<box
			style={{
				marginBottom: 1,
				backgroundColor: msg.role === "assistant" ? colors.bgLight : undefined,
				paddingLeft: msg.role === "assistant" ? 1 : 0,
				paddingRight: msg.role === "assistant" ? 1 : 0,
			}}
		>
			{msg.role === "system" ? (
				<text fg={colors.muted}>
					{text} <span fg={colors.muted}>{timestamp}</span>
				</text>
			) : msg.role === "user" ? (
				<text>
					<span fg={colors.text}>{text}</span>
					<span fg={colors.muted}> {timestamp}</span>
				</text>
			) : showThinking ? (
				<ThinkingDots />
			) : (
				<box style={{ flexDirection: "column" }}>
					{msg.parts.map((part, idx) => {
						if (part.type === "text") {
							const textPart = part as { type: "text"; text: string }
							if (!textPart.text) return null
							return (
								<box
									key={`text-${idx}`}
									style={{ flexDirection: "column", width: "100%" }}
								>
									<Markdown streaming={streaming}>{textPart.text}</Markdown>
								</box>
							)
						}
						if (part.type === "reasoning") {
							const reasoningPart = part as { type: "reasoning"; text: string }
							if (!reasoningPart.text) return null
							return (
								<ThinkingSection
									key={`reasoning-${idx}`}
									thinking={reasoningPart.text}
								/>
							)
						}
						if (isToolPart(part)) {
							const toolPart = part as ToolData
							return (
								<ToolPart
									key={toolPart.toolCallId || `tool-${idx}`}
									data={toolPart}
									messageAtom={messageAtom}
								/>
							)
						}
						return null
					})}

					{streaming ? (
						<AnimatedDots label="Generating" color={colors.muted} />
					) : (
						<text fg={colors.muted} style={{ width: "100%" }}>
							{timestamp}
						</text>
					)}
				</box>
			)}
		</box>
	)
}

export function MessageList() {
	const [messageAtoms] = useMessages()
	const { messageListScrollboxAtom } = useAppAtoms()

	return (
		<scrollbox
			ref={(ref) => messageListScrollboxAtom.set(ref)}
			stickyScroll
			stickyStart="bottom"
			style={{
				flexGrow: 1,
				paddingLeft: 1,
				paddingRight: 1,
				paddingTop: 1,
			}}
			focused={false}
		>
			{messageAtoms.map((msgAtom) => (
				<Message key={msgAtom.get().id} messageAtom={msgAtom} />
			))}
		</scrollbox>
	)
}
