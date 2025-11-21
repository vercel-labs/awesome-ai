import type { ToolUIPart } from "ai"
import type { ReactNode } from "react"
import { CodeBlock } from "@/components/elements/code-block"
import { DiffBlock, DiffBlockCopyButton } from "@/components/elements/diff-block"

/**
 * Get language for syntax highlighting from file extension
 */
export function getLanguageFromPath(filePath: string): string {
	const ext = filePath.split(".").pop()?.toLowerCase()
	const languageMap: Record<string, string> = {
		ts: "typescript",
		tsx: "typescript",
		js: "javascript",
		jsx: "javascript",
		json: "json",
		md: "markdown",
		py: "python",
		go: "go",
		rs: "rust",
		java: "java",
		cpp: "cpp",
		c: "c",
		cs: "csharp",
		php: "php",
		rb: "ruby",
		sh: "bash",
		bash: "bash",
		zsh: "bash",
		yml: "yaml",
		yaml: "yaml",
		xml: "xml",
		html: "html",
		css: "css",
		scss: "scss",
		sass: "sass",
		sql: "sql",
	}
	return languageMap[ext || ""] || "text"
}

/**
 * Extract structured information from tool input/output
 */
export function extractToolInfo(data: unknown): {
	filePath?: string
	content?: string
	diff?: string
	result?: string
	status?: string
	totalLines?: number
	command?: string
	description?: string
	other?: Record<string, unknown>
} {
	if (!data || typeof data !== "object") {
		return { other: { data } }
	}

	const dataObj = data as Record<string, unknown>
	const result: {
		filePath?: string
		content?: string
		diff?: string
		result?: string
		status?: string
		totalLines?: number
		command?: string
		description?: string
		other?: Record<string, unknown>
	} = {}

	// Extract filePath
	if ("filePath" in dataObj && typeof dataObj.filePath === "string") {
		result.filePath = dataObj.filePath
	}

	// Extract content
	if ("content" in dataObj && typeof dataObj.content === "string") {
		result.content = dataObj.content
	}

	// Extract diff
	if ("diff" in dataObj && typeof dataObj.diff === "string") {
		result.diff = dataObj.diff
	}

	// Extract result/status
	if ("result" in dataObj && typeof dataObj.result === "string") {
		result.result = dataObj.result
	}

	if ("status" in dataObj && typeof dataObj.status === "string") {
		result.status = dataObj.status
	}

	if ("totalLines" in dataObj && typeof dataObj.totalLines === "number") {
		result.totalLines = dataObj.totalLines
	}

	// Extract command and description (for bash tool)
	if ("command" in dataObj && typeof dataObj.command === "string") {
		result.command = dataObj.command
	}

	if ("description" in dataObj && typeof dataObj.description === "string") {
		result.description = dataObj.description
	}

	// Extract other fields
	const other: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(dataObj)) {
		if (
			![
				"filePath",
				"content",
				"diff",
				"result",
				"status",
				"totalLines",
				"command",
				"description",
			].includes(key)
		) {
			other[key] = value
		}
	}
	if (Object.keys(other).length > 0) {
		result.other = other
	}

	return result
}

/**
 * Format tool output into ReactNode with file paths, status, and formatted content
 */
export function formatToolOutputForDisplay(
	output: unknown,
	toolType?: ToolUIPart["type"],
): ReactNode {
	// Handle string output - try to parse as JSON
	if (typeof output === "string") {
		try {
			const parsed = JSON.parse(output)
			return formatToolOutputForDisplay(parsed, toolType)
		} catch {
			// Not JSON, treat as plain string
			return <div className="whitespace-pre-wrap break-words">{output}</div>
		}
	}

	// Handle object output
	if (output && typeof output === "object") {
		const info = extractToolInfo(output)

		return (
			<div className="space-y-3">
				{info.filePath && (
					<div className="space-y-1">
						<span className="text-muted-foreground text-xs font-medium">
							File Path:
						</span>
						<div className="rounded-md bg-muted/50 px-3 py-2 font-mono text-sm">
							{info.filePath}
						</div>
					</div>
				)}

				{info.result && (
					<div className="space-y-1">
						<span className="text-muted-foreground text-xs font-medium">
							Status:
						</span>
						<div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
							{info.result}
						</div>
					</div>
				)}

				{info.diff && (
					<div className="space-y-1">
						<span className="text-muted-foreground text-xs font-medium">
							Changes:
						</span>
						<div className="rounded-md bg-muted/50">
							<DiffBlock diff={info.diff}>
								<DiffBlockCopyButton />
							</DiffBlock>
						</div>
					</div>
				)}

				{!info.diff && info.content && (
					<div className="space-y-1">
						<span className="text-muted-foreground text-xs font-medium">
							{toolType === "tool-read"
								? "File Content:"
								: toolType === "tool-edit"
									? "Updated Content:"
									: "Content:"}
						</span>
						<div className="rounded-md bg-muted/50">
							<CodeBlock
								code={info.content}
								language={
									info.filePath ? getLanguageFromPath(info.filePath) : "text"
								}
							/>
						</div>
					</div>
				)}

				{info.command && (
					<div className="space-y-1">
						<span className="text-muted-foreground text-xs font-medium">
							Command:
						</span>
						<div className="rounded-md bg-muted/50">
							<CodeBlock code={info.command} language="bash" />
						</div>
					</div>
				)}

				{info.description && (
					<div className="space-y-1">
						<span className="text-muted-foreground text-xs font-medium">
							Description:
						</span>
						<div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
							{info.description}
						</div>
					</div>
				)}

				{info.other && Object.keys(info.other).length > 0 && (
					<div className="space-y-1">
						<span className="text-muted-foreground text-xs font-medium">
							Other Details:
						</span>
						<div className="rounded-md bg-muted/50">
							<CodeBlock
								code={JSON.stringify(info.other, null, 2)}
								language="json"
							/>
						</div>
					</div>
				)}
			</div>
		)
	}

	// Fallback: stringify non-object outputs
	return (
		<div className="rounded-md bg-muted/50 p-3">
			<CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
		</div>
	)
}
