import { useAtom } from "@lfades/atom"
import { RGBA, SyntaxStyle } from "@opentui/core"
import { colors } from "../theme"
import { getMessageReasoning, getMessageText } from "../types"
import { isLoadingAtom, messagesAtom } from "./atoms"
import { ThinkingSection } from "./thinking-section"

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

export function MessageList() {
	const [messages] = useAtom(messagesAtom)
	const [isLoading] = useAtom(isLoadingAtom)

	return (
		<scrollbox
			style={{
				flexGrow: 1,
				paddingLeft: 1,
				paddingRight: 1,
				paddingTop: 1,
			}}
			focused={false}
		>
			{messages.map((msg) => {
				const text = getMessageText(msg)
				const reasoning = getMessageReasoning(msg)
				const timestamp = msg.metadata?.timestamp ?? ""

				return (
					<box
						key={msg.id}
						style={{
							marginBottom: 1,
							backgroundColor:
								msg.role === "assistant" ? colors.bgLight : undefined,
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
						) : (
							<box style={{ flexDirection: "column" }}>
								{reasoning && <ThinkingSection thinking={reasoning} />}
								<code
									content={text}
									filetype="markdown"
									syntaxStyle={syntaxStyle}
								/>
								<text fg={colors.muted}>{timestamp}</text>

								{/* Render tool parts */}
								{msg.parts
									.filter((part) => part.type.startsWith("tool-"))
									.map((part, idx) => {
										const toolPart = part as {
											type: string
											toolCallId: string
											state: string
											input?: unknown
											output?: unknown
										}
										const toolName = toolPart.type.replace("tool-", "")
										return (
											<box
												key={toolPart.toolCallId || idx}
												style={{
													marginTop: 1,
													border: true,
													borderStyle: "single",
													borderColor: colors.border,
													paddingLeft: 1,
													paddingRight: 1,
												}}
											>
												<text>
													<span fg={colors.green}>{toolName}</span>
													<span fg={colors.muted}> ({toolPart.state})</span>
												</text>
											</box>
										)
									})}
							</box>
						)}
					</box>
				)
			})}
			{isLoading && (
				<box
					style={{
						backgroundColor: colors.bgLight,
						paddingLeft: 1,
						paddingRight: 1,
					}}
				>
					<text fg={colors.muted}>thinking...</text>
				</box>
			)}
		</scrollbox>
	)
}
