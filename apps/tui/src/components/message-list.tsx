import { useAtom } from "@lfades/atom"
import { RGBA, SyntaxStyle } from "@opentui/core"
import { colors } from "../theme"
import { formatTimestamp, getMessageReasoning, getMessageText } from "../types"
import {
	type MessageAtom,
	messageListScrollboxAtom,
	messagesAtom,
} from "./atoms"
import { ThinkingSection } from "./thinking-section"
import { type ToolData, ToolPart } from "./tool-part"
import { StreamingIndicator } from "./ui/streaming-indicator"
import { ThinkingDots } from "./ui/thinking-dots"

// GitHub Dark-inspired syntax style for markdown
const syntaxStyle = SyntaxStyle.fromStyles({
	// Markdown headings
	"markup.heading": { fg: RGBA.fromHex("#79C0FF"), bold: true },
	"markup.heading.1": { fg: RGBA.fromHex("#79C0FF"), bold: true },
	"markup.heading.2": { fg: RGBA.fromHex("#79C0FF"), bold: true },
	"markup.heading.marker": { fg: RGBA.fromHex("#79C0FF") },

	// Text formatting
	"markup.bold": { fg: RGBA.fromHex("#E6EDF3"), bold: true },
	"markup.italic": { fg: RGBA.fromHex("#E6EDF3"), italic: true },
	"markup.strikethrough": { fg: RGBA.fromHex("#8B949E") },

	// Code
	"markup.raw": { fg: RGBA.fromHex("#A5D6FF"), bg: RGBA.fromHex("#161B22") },
	"markup.raw.block": { fg: RGBA.fromHex("#E6EDF3") },
	"markup.link": { fg: RGBA.fromHex("#58A6FF"), underline: true },
	"markup.link.url": { fg: RGBA.fromHex("#8B949E") },

	// Lists
	"markup.list.marker": { fg: RGBA.fromHex("#F78C6C") },
	punctuation: { fg: RGBA.fromHex("#8B949E") },

	// Code block syntax (for embedded code)
	keyword: { fg: RGBA.fromHex("#FF7B72"), bold: true },
	"keyword.import": { fg: RGBA.fromHex("#FF7B72") },
	function: { fg: RGBA.fromHex("#D2A8FF") },
	"function.method": { fg: RGBA.fromHex("#D2A8FF") },
	string: { fg: RGBA.fromHex("#A5D6FF") },
	number: { fg: RGBA.fromHex("#79C0FF") },
	comment: { fg: RGBA.fromHex("#8B949E"), italic: true },
	type: { fg: RGBA.fromHex("#FFA657") },
	"type.builtin": { fg: RGBA.fromHex("#FFA657") },
	operator: { fg: RGBA.fromHex("#FF7B72") },
	variable: { fg: RGBA.fromHex("#E6EDF3") },
	"variable.builtin": { fg: RGBA.fromHex("#FFA657") },
	property: { fg: RGBA.fromHex("#79C0FF") },
	constant: { fg: RGBA.fromHex("#79C0FF") },

	// Default
	default: { fg: RGBA.fromHex("#E6EDF3") },
})

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
					<box style={{ flexDirection: "row", width: "100%" }}>
						{/* <code */}
						{/* 	content={text} */}
						{/* 	filetype="markdown" */}
						{/* 	syntaxStyle={syntaxStyle} */}
						{/* 	style={{ flexShrink: 1 }} */}
						{/* /> */}
						<text fg={colors.text}>{text}</text>
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
