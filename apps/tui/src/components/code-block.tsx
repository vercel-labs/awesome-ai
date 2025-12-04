/**
 * Code block component for terminal UI with shiki syntax highlighting
 * Uses a Worker thread to avoid blocking the UI
 */

import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Worker } from "node:worker_threads"
import {
	memo,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import type { ThemedToken, TokensResult } from "shiki"

/** Creates a throttled function that invokes at most once per `wait` ms, with trailing call */
function useThrottle<T extends (...args: Parameters<T>) => void>(
	callback: T,
	wait: number,
): T {
	const lastCallRef = useRef(0)
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const callbackRef = useRef(callback)

	callbackRef.current = callback

	// biome-ignore lint/correctness/useExhaustiveDependencies: `wait` is a dependency.
	return useCallback(
		((...args) => {
			const now = Date.now()

			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}

			if (now - lastCallRef.current >= wait) {
				lastCallRef.current = now
				callbackRef.current(...args)
			}

			// Trailing call
			timeoutRef.current = setTimeout(() => {
				lastCallRef.current = Date.now()
				callbackRef.current(...args)
			}, wait)
		}) as T,
		[wait],
	)
}

const codeColors = {
	background: "#0D1117",
	headerBg: "#161B22",
	border: "#30363D",
	text: "#E6EDF3",
	lineNumber: "#6E7681",
	language: "#8B949E",
}

const pendingRequests = new Map<string, Set<(result: TokensResult) => void>>()

// Worker management
let worker: Worker | null = null
let workerReady = false

const getTokensCacheKey = (code: string, language: string) => {
	const start = code.slice(0, 100)
	const end = code.length > 100 ? code.slice(-100) : ""
	return `${language || "text"}:${code.length}:${start}:${end}`
}

function initWorker() {
	if (worker) return

	try {
		// Get the path to the worker file
		const currentFile = fileURLToPath(import.meta.url)
		const currentDir = dirname(currentFile)
		const workerPath = join(currentDir, "../utils/shiki-worker.ts")

		worker = new Worker(workerPath)
		workerReady = true

		worker.on(
			"message",
			(response: {
				id: string
				tokens: ThemedToken[][]
				bg?: string
				fg?: string
			}) => {
				const callbacks = pendingRequests.get(response.id)
				if (callbacks) {
					const result: TokensResult = {
						tokens: response.tokens,
						bg: response.bg,
						fg: response.fg,
					}

					// Notify all callbacks
					for (const cb of callbacks) {
						cb(result)
					}
					pendingRequests.delete(response.id)
				}
			},
		)

		worker.on("error", (err) => {
			console.error("Shiki worker error:", err)
			workerReady = false
		})

		worker.on("exit", (code) => {
			if (code !== 0) {
				console.error(`Shiki worker exited with code ${code}`)
			}
			worker = null
			workerReady = false
		})
	} catch (err) {
		console.error("Failed to create shiki worker:", err)
		workerReady = false
	}
}

/**
 * Request highlighting from worker
 */
function requestHighlight(
	code: string,
	language: string,
	callback: (result: TokensResult) => void,
): void {
	const requestKey = getTokensCacheKey(code, language)

	// Subscribe callback
	if (!pendingRequests.has(requestKey)) {
		pendingRequests.set(requestKey, new Set())
	}
	pendingRequests.get(requestKey)!.add(callback)

	// If already pending, don't send duplicate request
	if (pendingRequests.get(requestKey)!.size > 1) return

	// Initialize worker lazily
	if (!worker) initWorker()

	// If worker failed to initialize, callback won't be called (component shows raw)
	if (!workerReady || !worker) return

	// Send request to worker
	worker.postMessage({
		id: requestKey,
		code,
		language,
	})
}

interface CodeBlockProps {
	code: string
	language?: string
	streaming?: boolean
	isFirst?: boolean
	children?: ReactNode
}

export const CodeBlock = memo(function CodeBlock({
	code,
	language = "",
	streaming = false,
	children,
}: CodeBlockProps) {
	// Raw fallback tokens (shown while shiki loads)
	const raw: TokensResult = useMemo(
		() => ({
			bg: codeColors.background,
			fg: codeColors.text,
			tokens: code.split("\n").map((line) => [
				{
					content: line,
					color: codeColors.text,
					offset: 0,
				},
			]),
		}),
		[code],
	)
	const [result, setResult] = useState<TokensResult>(raw)

	const throttledHighlight = useThrottle(
		(c: string, l: string) => requestHighlight(c, l, setResult),
		100,
	)

	useEffect(() => {
		if (streaming) {
			throttledHighlight(code, language)
		} else {
			requestHighlight(code, language, setResult)
		}
	}, [code, language, streaming, throttledHighlight])

	const lines = result.tokens
	const lineCount = lines.length
	const lineNumWidth = Math.max(3, String(lineCount).length)
	const showLineNumbers = lineCount > 1

	return (
		<box
			style={{
				flexDirection: "column",
				border: true,
				borderStyle: "single",
				borderColor: codeColors.border,
				backgroundColor: codeColors.background,
			}}
		>
			{language && (
				<box
					style={{
						flexDirection: "row",
						justifyContent: "space-between",
						paddingLeft: 1,
						paddingRight: 1,
						backgroundColor: codeColors.headerBg,
					}}
				>
					<text fg={codeColors.language}>{language}</text>
					{children && (
						<box style={{ flexDirection: "row", gap: 1 }}>{children}</box>
					)}
				</box>
			)}

			<box
				style={{
					flexDirection: "column",
					paddingLeft: 1,
					paddingRight: 1,
				}}
			>
				{lines.map((lineTokens: ThemedToken[], lineIdx: number) => (
					<text key={lineIdx}>
						{showLineNumbers && (
							<span fg={codeColors.lineNumber}>
								{String(lineIdx + 1).padStart(lineNumWidth, " ")} │{" "}
							</span>
						)}
						{lineTokens.map((token: ThemedToken, tokenIdx: number) => (
							<span key={tokenIdx} fg={token.color || codeColors.text}>
								{token.content}
							</span>
						))}
					</text>
				))}
			</box>
		</box>
	)
})

CodeBlock.displayName = "CodeBlock"
