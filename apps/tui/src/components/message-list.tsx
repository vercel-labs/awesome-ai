import { useAtom } from "@lfades/atom"
import { colors } from "../theme"
import { formatTimestamp, getMessageReasoning, getMessageText } from "../types"
import {
	type MessageAtom,
	messageListScrollboxAtom,
	messagesAtom,
} from "./atoms"
import { Markdown } from "./markdown"
import { ThinkingSection } from "./thinking-section"
import { type ToolData, ToolPart } from "./tool-part"
import { StreamingIndicator } from "./ui/streaming-indicator"
import { ThinkingDots } from "./ui/thinking-dots"

function Message({ messageAtom }: { messageAtom: MessageAtom }) {
	const [msg] = useAtom(messageAtom)
	const text = getMessageText(msg)
	const reasoning = getMessageReasoning(msg)
	const streaming = msg.metadata?.streaming
	const timestamp = msg.metadata?.timestamp
		? formatTimestamp(msg.metadata.timestamp)
		: ""
	// When streaming with no content yet, show "thinking..."
	const showThinking = streaming && !text && !reasoning

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
					{reasoning && <ThinkingSection thinking={reasoning} />}
					<box style={{ flexDirection: "column", width: "100%" }}>
						<Markdown streaming={streaming}>{text}</Markdown>
						{streaming && <StreamingIndicator color={colors.muted} />}
					</box>
					{!streaming && (
						<text fg={colors.muted} style={{ width: "100%" }}>
							{timestamp}
						</text>
					)}

					{/* Render tool parts */}
					{msg.parts
						.filter(
							(part) =>
								part.type.startsWith("tool-") || part.type === "dynamic-tool",
						)
						.map((part, idx) => {
							const toolPart = part as ToolData
							return (
								<ToolPart
									key={toolPart.toolCallId || idx}
									data={toolPart}
									messageAtom={messageAtom}
								/>
							)
						})}
				</box>
			)}
		</box>
	)
}

export function MessageList() {
	const [messageAtoms] = useAtom(messagesAtom)

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
