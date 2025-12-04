/**
 * Markdown rendering components for terminal UI
 */

import {
	type ReactNode,
	useEffect,
	useId,
	useMemo,
	useState,
	useTransition,
} from "react"
import { parseIncompleteMarkdown } from "streamdown"
import { colors } from "../theme"
import { CodeBlock } from "./code-block"

const markdownColors = {
	text: colors.text,
	bold: colors.text,
	italic: colors.text,
	code: "#A5D6FF",
	codeBg: "#161B22",
	link: "#58A6FF",
	heading: "#79C0FF",
	listMarker: "#F78C6C",
	blockquote: colors.muted,
	strikethrough: colors.muted,
}

type InlineTokenType =
	| "text"
	| "bold"
	| "italic"
	| "bold-italic"
	| "code"
	| "strikethrough"
	| "link"

interface InlineToken {
	type: InlineTokenType
	content: string
	url?: string
}

// Order matters: more specific patterns (***) must come before less specific (**)
const inlinePatterns: ReadonlyArray<{
	regex: RegExp
	type: Exclude<InlineTokenType, "text">
	urlGroup?: number
}> = [
	{ regex: /\*\*\*(.+?)\*\*\*/g, type: "bold-italic" },
	{ regex: /\*\*(.+?)\*\*/g, type: "bold" },
	{ regex: /(?<!\*)\*([^*]+?)\*(?!\*)/g, type: "italic" },
	{ regex: /(?<!_)_([^_]+?)_(?!_)/g, type: "italic" },
	{ regex: /~~(.+?)~~/g, type: "strikethrough" },
	{ regex: /`([^`]+?)`/g, type: "code" },
	{ regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: "link", urlGroup: 2 },
]

/**
 * Tokenize inline markdown into styled segments
 */
function tokenizeInline(text: string): InlineToken[] {
	const tokens: InlineToken[] = []
	const matches: Array<{ start: number; end: number; token: InlineToken }> = []

	// Find all matches using pre-compiled patterns
	for (const pattern of inlinePatterns) {
		pattern.regex.lastIndex = 0 // Reset regex state for reuse
		let match: RegExpExecArray | null = pattern.regex.exec(text)
		while (match !== null) {
			matches.push({
				start: match.index,
				end: match.index + match[0].length,
				token: {
					type: pattern.type,
					content: match[1] ?? "",
					url: pattern.urlGroup ? match[pattern.urlGroup] : undefined,
				},
			})
			match = pattern.regex.exec(text)
		}
	}

	// Sort by start position
	matches.sort((a, b) => a.start - b.start)

	// Filter overlapping (keep first match)
	const filtered: typeof matches = []
	let lastEnd = 0
	for (const m of matches) {
		if (m.start >= lastEnd) {
			filtered.push(m)
			lastEnd = m.end
		}
	}

	// Build token list with text segments between matches
	let pos = 0
	for (const m of filtered) {
		if (m.start > pos) {
			tokens.push({ type: "text", content: text.slice(pos, m.start) })
		}
		tokens.push(m.token)
		pos = m.end
	}

	// Add remaining text
	if (pos < text.length) {
		tokens.push({ type: "text", content: text.slice(pos) })
	}

	// Handle empty input
	if (tokens.length === 0 && text) {
		tokens.push({ type: "text", content: text })
	}

	return tokens
}

/**
 * Render inline markdown tokens as opentui JSX
 */
function renderInlineTokens(tokens: InlineToken[]): ReactNode[] {
	return tokens.map((token, idx) => {
		switch (token.type) {
			case "bold":
				return (
					<strong key={idx} fg={markdownColors.bold}>
						{token.content}
					</strong>
				)
			case "italic":
				return (
					<em key={idx} fg={markdownColors.italic}>
						{token.content}
					</em>
				)
			case "bold-italic":
				return (
					<strong key={idx} fg={markdownColors.bold}>
						<em>{token.content}</em>
					</strong>
				)
			case "code":
				return (
					<span key={idx} fg={markdownColors.code} bg={markdownColors.codeBg}>
						{token.content}
					</span>
				)
			case "strikethrough":
				return (
					<span key={idx} fg={markdownColors.strikethrough}>
						{token.content}
					</span>
				)
			case "link":
				return (
					<u key={idx} fg={markdownColors.link}>
						{token.content}
					</u>
				)
			case "text":
				return <span key={idx}>{token.content}</span>
			default:
				return <span key={idx}>{token.content}</span>
		}
	})
}

interface MarkdownProps {
	children: string
	streaming?: boolean
}

/**
 * Parse and render a heading line
 */
function HeadingBlock({
	content,
	level,
	isFirst,
}: {
	content: string
	level: number
	isFirst?: boolean
}) {
	const tokens = tokenizeInline(content)
	const prefix = `${"#".repeat(level)} `

	return (
		<box style={{ marginTop: isFirst ? 0 : 1 }}>
			<text fg={markdownColors.heading}>
				<strong>
					{prefix}
					{renderInlineTokens(tokens)}
				</strong>
			</text>
		</box>
	)
}

/**
 * Render a list (ordered or unordered) with nested indentation support
 */
function ListBlock({
	items,
	itemsWithIndent,
	ordered,
}: {
	items?: string[]
	itemsWithIndent?: ListItem[]
	ordered?: boolean
}) {
	// Use itemsWithIndent if available, otherwise fall back to items
	const listItems: ListItem[] = itemsWithIndent
		? itemsWithIndent
		: (items || []).map((text) => ({ text, indent: 0 }))

	// Track numbering per indent level for ordered lists
	const numberingByIndent: Record<number, number> = {}

	return (
		<box style={{ flexDirection: "column" }}>
			{listItems.map((item, idx) => {
				// Update numbering for this indent level
				if (ordered) {
					numberingByIndent[item.indent] =
						(numberingByIndent[item.indent] || 0) + 1
					// Reset deeper levels when we go back up
					for (const key of Object.keys(numberingByIndent)) {
						if (Number(key) > item.indent) {
							delete numberingByIndent[Number(key)]
						}
					}
				}

				const number = numberingByIndent[item.indent] || idx + 1
				const marker = ordered ? `${number}. ` : "• "
				const tokens = tokenizeInline(item.text)
				const padding = "  ".repeat(item.indent)

				return (
					<text key={idx}>
						<span>{padding}</span>
						<span fg={markdownColors.listMarker}>{marker}</span>
						{renderInlineTokens(tokens)}
					</text>
				)
			})}
		</box>
	)
}

function BlockquoteBlock({ content }: { content: string }) {
	const lines = content.split("\n")
	return (
		<box
			style={{
				flexDirection: "column",
				borderColor: markdownColors.blockquote,
				paddingLeft: 1,
			}}
		>
			{lines.map((line, idx) => {
				const tokens = tokenizeInline(line)
				return (
					<text key={idx} fg={markdownColors.blockquote}>
						<em>{renderInlineTokens(tokens)}</em>
					</text>
				)
			})}
		</box>
	)
}

function HorizontalRule() {
	return <text fg={colors.border}>{"─".repeat(40)}</text>
}

interface ListItem {
	text: string
	indent: number
}

interface ParsedBlock {
	type: "paragraph" | "heading" | "list" | "blockquote" | "hr" | "code"
	content: string
	level?: number
	items?: string[]
	itemsWithIndent?: ListItem[]
	ordered?: boolean
	language?: string
}

const headingPattern = /^(#{1,6})\s+(.*)$/
const hrPattern = /^(-{3,}|\*{3,}|_{3,})$/
const listItemPattern = /^(\s*)([-*+]|\d+\.)\s+(.*)$/
const orderedListPattern = /^\d+\./
const blockquoteStripPattern = /^(>\s*)+/

function parseBlocks(text: string): ParsedBlock[] {
	const blocks: ParsedBlock[] = []
	const lines = text.split("\n")
	let i = 0

	while (i < lines.length) {
		const line = lines[i]!
		const trimmedLine = line.trim()

		// Code block
		if (line.startsWith("```")) {
			const language = line.slice(3).trim()
			const codeLines: string[] = []
			i += 1
			while (i < lines.length && !lines[i]?.startsWith("```")) {
				codeLines.push(lines[i]!)
				i += 1
			}
			blocks.push({
				type: "code",
				content: codeLines.join("\n"),
				language: language || undefined,
			})
			i += 1
			continue
		}

		// Heading
		const headingMatch = line.match(headingPattern)
		if (headingMatch) {
			blocks.push({
				type: "heading",
				content: headingMatch[2] ?? "",
				level: headingMatch[1]?.length ?? 1,
			})
			i += 1
			continue
		}

		// Horizontal rule
		if (hrPattern.test(trimmedLine)) {
			blocks.push({ type: "hr", content: "" })
			i += 1
			continue
		}

		// List
		const listMatch = line.match(listItemPattern)
		if (listMatch) {
			const items: Array<{ text: string; indent: number }> = []
			const ordered = orderedListPattern.test(listMatch[2] ?? "")
			const baseIndent = listMatch[1]?.length ?? 0

			while (i < lines.length) {
				const listLine = lines[i]!
				const itemMatch = listLine.match(listItemPattern)
				if (itemMatch) {
					const indent = Math.floor(
						((itemMatch[1]?.length ?? 0) - baseIndent) / 2,
					)
					items.push({ text: itemMatch[3] ?? "", indent: Math.max(0, indent) })
					i += 1
				} else if (listLine.trim() === "") {
					i += 1
					break
				} else {
					break
				}
			}
			blocks.push({
				type: "list",
				content: items.map((item) => item.text).join("\n"),
				items: items.map((item) => item.text),
				itemsWithIndent: items,
				ordered,
			})
			continue
		}

		// Blockquote
		if (line.startsWith(">")) {
			const quoteLines: string[] = []
			while (i < lines.length) {
				const currentLine = lines[i]!
				if (!currentLine.startsWith(">") && currentLine.trim() !== "") break
				// Strip all leading > characters (handles nested blockquotes)
				const stripped = currentLine.replace(blockquoteStripPattern, "")
				quoteLines.push(stripped)
				i += 1
				// Break on empty line that's not a blockquote continuation
				const prevLine = lines[i - 1]
				const nextLine = lines[i]
				if (
					prevLine?.trim() === "" &&
					i < lines.length &&
					nextLine !== undefined &&
					!nextLine.startsWith(">")
				) {
					break
				}
			}
			blocks.push({
				type: "blockquote",
				content: quoteLines.join("\n").trim(),
			})
			continue
		}

		// Empty line
		if (trimmedLine === "") {
			i += 1
			continue
		}

		// Paragraph - consume any remaining lines that don't match other patterns
		const paragraphLines: string[] = []
		while (i < lines.length) {
			const pLine = lines[i]!
			const pTrimmed = pLine.trim()
			if (
				pTrimmed === "" ||
				pLine.startsWith("```") ||
				pLine.startsWith("#") ||
				pLine.startsWith(">") ||
				listItemPattern.test(pLine) ||
				hrPattern.test(pTrimmed)
			) {
				break
			}
			paragraphLines.push(pLine)
			i += 1
		}

		if (paragraphLines.length > 0) {
			blocks.push({
				type: "paragraph",
				content: paragraphLines.join("\n"),
			})
		} else {
			// Safety: if nothing matched, skip the line to avoid an infinite loop
			i += 1
		}
	}

	return blocks
}

function ParagraphBlock({ content }: { content: string }) {
	// Split by newlines and render each line
	const lines = content.split("\n")
	if (lines.length === 1) {
		const tokens = tokenizeInline(content)
		return (
			<box>
				<text>{renderInlineTokens(tokens)}</text>
			</box>
		)
	}

	return (
		<box style={{ flexDirection: "column" }}>
			{lines.map((line, idx) => {
				const tokens = tokenizeInline(line)
				return <text key={idx}>{renderInlineTokens(tokens)}</text>
			})}
		</box>
	)
}

/**
 * Render a single block
 */
function BlockRenderer({
	block,
	isFirst,
	streaming = false,
}: {
	block: ParsedBlock
	isFirst: boolean
	streaming?: boolean
}) {
	switch (block.type) {
		case "heading":
			return (
				<HeadingBlock
					content={block.content}
					level={block.level ?? 1}
					isFirst={isFirst}
				/>
			)
		case "list":
			return (
				<ListBlock
					items={block.items}
					itemsWithIndent={block.itemsWithIndent}
					ordered={block.ordered}
				/>
			)
		case "blockquote":
			return <BlockquoteBlock content={block.content} />
		case "hr":
			return <HorizontalRule />
		case "code":
			return (
				<CodeBlock
					code={block.content}
					language={block.language}
					streaming={streaming}
					isFirst={isFirst}
				/>
			)
		case "paragraph":
			return <ParagraphBlock content={block.content} />
	}
}

export function Markdown({ children, streaming = false }: MarkdownProps) {
	const generatedId = useId()
	const [, startTransition] = useTransition()
	const [displayBlocks, setDisplayBlocks] = useState<ParsedBlock[]>([])

	// Process incomplete markdown for streaming
	const processed = useMemo(
		() => (streaming ? parseIncompleteMarkdown(children) : children),
		[children, streaming],
	)

	// Parse into blocks - memoized to avoid reparsing on every render
	const blocks = useMemo(() => parseBlocks(processed), [processed])

	// Use transition for block updates in streaming mode to avoid blocking UI
	useEffect(() => {
		if (streaming) {
			startTransition(() => {
				setDisplayBlocks(blocks)
			})
		} else {
			setDisplayBlocks(blocks)
		}
	}, [blocks, streaming])

	// Use displayBlocks for rendering to leverage useTransition
	const blocksToRender = streaming ? displayBlocks : blocks

	// Generate stable keys based on index only
	// Don't use content hash - that causes unmount/remount when content changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: using blocksToRender.length intentionally
	const blockKeys = useMemo(
		() => blocksToRender.map((_, idx) => `${generatedId}-${idx}`),
		[blocksToRender.length, generatedId],
	)

	if (!children) return null

	if (blocksToRender.length === 0) {
		return <text fg={colors.text}>{processed}</text>
	}

	return (
		<box style={{ flexDirection: "column" }}>
			{blocksToRender.map((block, idx) => (
				<BlockRenderer
					key={blockKeys[idx]}
					block={block}
					isFirst={idx === 0}
					streaming={streaming}
				/>
			))}
		</box>
	)
}
