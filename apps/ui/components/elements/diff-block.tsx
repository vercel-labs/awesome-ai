"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import type { HTMLAttributes } from "react"
import { createContext, useContext, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DiffBlockContextType = {
	diff: string
}

const DiffBlockContext = createContext<DiffBlockContextType>({
	diff: "",
})

type LineType = "addition" | "deletion" | "context" | "hunk-header"

interface DiffLine {
	type: LineType
	content: string
	oldLineNo: number | null
	newLineNo: number | null
}

function parseDiff(diffText: string): DiffLine[] {
	const lines = diffText.split("\n")
	const result: DiffLine[] = []
	let oldLineNo = 0
	let newLineNo = 0

	for (const line of lines) {
		// Skip file headers (--- and +++)
		if (line.startsWith("---") || line.startsWith("+++")) {
			continue
		}

		// Parse hunk headers (@@ -oldStart,oldLines +newStart,newLines @@)
		if (line.startsWith("@@")) {
			const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/)
			if (match) {
				oldLineNo = Number.parseInt(match[1], 10) - 1
				newLineNo = Number.parseInt(match[2], 10) - 1
			}
			result.push({
				type: "hunk-header",
				content: line,
				oldLineNo: null,
				newLineNo: null,
			})
			continue
		}

		// Parse diff lines
		if (line.startsWith("+")) {
			newLineNo++
			result.push({
				type: "addition",
				content: line.substring(1),
				oldLineNo: null,
				newLineNo,
			})
		} else if (line.startsWith("-")) {
			oldLineNo++
			result.push({
				type: "deletion",
				content: line.substring(1),
				oldLineNo,
				newLineNo: null,
			})
		} else if (line.startsWith(" ")) {
			oldLineNo++
			newLineNo++
			result.push({
				type: "context",
				content: line.substring(1),
				oldLineNo,
				newLineNo,
			})
		}
	}

	return result
}

export type DiffBlockProps = HTMLAttributes<HTMLDivElement> & {
	diff: string
	children?: React.ReactNode
}

export const DiffBlock = ({
	diff,
	className,
	children,
	...props
}: DiffBlockProps) => {
	const parsedLines = useMemo(() => parseDiff(diff), [diff])

	return (
		<DiffBlockContext.Provider value={{ diff }}>
			<div
				className={cn(
					"relative w-full overflow-hidden rounded-md border bg-background",
					className,
				)}
				{...props}
			>
				<div className="relative">
					<div className="overflow-x-auto">
						<table className="w-full border-collapse font-mono text-xs">
							<tbody>
								{parsedLines.map((line, index) => {
									if (line.type === "hunk-header") {
										return (
											<tr key={index} className="bg-muted/50">
												<td
													className="px-2 py-1 text-center text-muted-foreground"
													colSpan={3}
												>
													{line.content}
												</td>
											</tr>
										)
									}

									const lineClass =
										line.type === "addition"
											? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
											: line.type === "deletion"
												? "bg-red-500/10 text-red-700 dark:text-red-400"
												: "bg-background"

									const lineNumberClass =
										line.type === "addition"
											? "text-emerald-700 dark:text-emerald-400"
											: line.type === "deletion"
												? "text-red-700 dark:text-red-400"
												: "text-muted-foreground"

									return (
										<tr key={index} className={lineClass}>
											<td
												className={cn(
													"w-12 select-none px-2 py-0.5 text-right",
													lineNumberClass,
												)}
											>
												{line.oldLineNo || ""}
											</td>
											<td
												className={cn(
													"w-12 select-none px-2 py-0.5 text-right",
													lineNumberClass,
												)}
											>
												{line.newLineNo || ""}
											</td>
											<td className="px-2 py-0.5">
												<pre className="m-0 whitespace-pre-wrap break-all">
													{line.content || " "}
												</pre>
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
					{children && (
						<div className="absolute top-2 right-2 flex items-center gap-2">
							{children}
						</div>
					)}
				</div>
			</div>
		</DiffBlockContext.Provider>
	)
}

export const DiffBlockCopyButton = ({
	onCopy,
	onError,
	timeout = 2000,
	children,
	className,
	...props
}: {
	onCopy?: () => void
	onError?: (error: Error) => void
	timeout?: number
	children?: React.ReactNode
	className?: string
}) => {
	const [isCopied, setIsCopied] = useState(false)
	const { diff } = useContext(DiffBlockContext)

	const copyToClipboard = async () => {
		if (typeof window === "undefined" || !navigator.clipboard.writeText) {
			onError?.(new Error("Clipboard API not available"))
			return
		}

		try {
			await navigator.clipboard.writeText(diff)
			setIsCopied(true)
			onCopy?.()
			setTimeout(() => setIsCopied(false), timeout)
		} catch (error) {
			onError?.(error as Error)
		}
	}

	const Icon = isCopied ? CheckIcon : CopyIcon

	return (
		<Button
			className={cn("shrink-0", className)}
			onClick={copyToClipboard}
			size="icon"
			variant="ghost"
			{...props}
		>
			{children ?? <Icon size={14} />}
		</Button>
	)
}
