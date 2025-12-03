import { useAtom } from "@lfades/atom"
import { useEffect, useState } from "react"
import { colors } from "../theme"
import { getToolError, getToolMessage, getToolStatus } from "../types"
import { handleToolApproval } from "../utils/agent"
import {
	addPendingApproval,
	type MessageAtom,
	type PendingApproval,
	pendingApprovalsAtom,
	removePendingApproval,
} from "./atoms"
import { Spinner } from "./ui/spinner"

// AI SDK tool part states
type ToolState =
	| "input-streaming"
	| "input-available"
	| "approval-requested"
	| "approval-responded"
	| "output-available"
	| "output-error"
	| "output-denied"

export interface ToolData {
	type: string
	toolName?: string
	toolCallId: string
	state: ToolState
	input?: unknown
	output?: unknown
	errorText?: string
	approval?: {
		id: string
		approved?: boolean
		reason?: string
	}
}

function isInProgress(state: ToolState, toolStatus?: string) {
	return (
		toolStatus === "pending" ||
		toolStatus === "streaming" ||
		state === "input-streaming" ||
		state === "input-available" ||
		state === "approval-responded"
	)
}

function getStatusIndicator(
	state: ToolState,
	toolStatus?: string,
): { icon: string; color: string } {
	if (toolStatus === "success") {
		return { icon: "✓", color: colors.green }
	}
	if (toolStatus === "error") {
		return { icon: "✗", color: "#ef4444" }
	}

	// Fall back to AI SDK state
	switch (state) {
		case "approval-requested":
			return { icon: "?", color: "#f59e0b" }
		case "output-available":
			return { icon: "✓", color: colors.green }
		case "output-error":
			return { icon: "✗", color: "#ef4444" }
		case "output-denied":
			return { icon: "⊘", color: "#f59e0b" }
		default:
			return { icon: "•", color: colors.muted }
	}
}

function formatValue(value: unknown, maxLength = 200): string {
	if (value === undefined || value === null) return ""
	if (typeof value === "string") {
		return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
	}
	const json = JSON.stringify(value, null, 2)
	return json.length > maxLength ? `${json.slice(0, maxLength)}...` : json
}

export interface ToolPartProps {
	data: ToolData
	messageAtom?: MessageAtom
}

export function ToolPart({ data, messageAtom }: ToolPartProps) {
	const { input, output, state, errorText, approval } = data
	const [pendingApprovals] = useAtom(pendingApprovalsAtom)
	// Extract tool name: for typed tools it's `tool-${name}`, for dynamic it's in toolName
	const toolName =
		data.type === "dynamic-tool"
			? data.toolName || "unknown"
			: data.type.replace("tool-", "")
	const [expanded, setExpanded] = useState(false)
	const toolStatus = getToolStatus(output)
	const toolMessage = getToolMessage(output)
	const toolError = getToolError(output)
	const inProgress = isInProgress(state, toolStatus)
	const { icon, color } = getStatusIndicator(state, toolStatus)

	// Check if this is the first pending approval (for highlighting)
	const isFirstPending =
		state === "approval-requested" &&
		pendingApprovals[0]?.toolCallId === data.toolCallId

	// Register this approval request when it becomes active
	useEffect(() => {
		if (state === "approval-requested" && approval?.id && messageAtom) {
			const pendingApproval: PendingApproval = {
				toolCallId: data.toolCallId,
				approvalId: approval.id,
				toolName,
				messageAtom,
			}
			addPendingApproval(pendingApproval)

			return () => {
				removePendingApproval(data.toolCallId)
			}
		}
	}, [state, approval?.id, data.toolCallId, toolName, messageAtom])

	// Determine display message
	let displayMessage = toolMessage
	if (!displayMessage) {
		if (state === "output-error" || toolStatus === "error") {
			displayMessage = errorText || toolError || "Error"
		} else if (state === "approval-requested") {
			displayMessage = "Waiting for approval..."
		} else if (state === "output-denied") {
			displayMessage = "Denied by user"
		} else if (state === "approval-responded") {
			displayMessage = approval?.approved
				? "Approved, executing..."
				: "Denied by user"
		} else if (state === "input-streaming" || state === "input-available") {
			displayMessage = "Running..."
		}
	}

	// Check if we have details to show
	const hasInput = input !== undefined && input !== null
	const hasOutput =
		output !== undefined &&
		output !== null &&
		typeof output === "object" &&
		Object.keys(output).length > 0
	const hasDetails = hasInput || hasOutput || toolError

	// Force expanded when this is the first pending approval
	const isExpanded = isFirstPending || expanded
	const canToggle = hasDetails && !isFirstPending

	const toggle = () => {
		if (canToggle) setExpanded(!expanded)
	}

	return (
		<box
			style={{
				flexDirection: "column",
				border: true,
				borderStyle: "single",
				borderColor: isFirstPending ? "#f59e0b" : colors.border,
				paddingLeft: 1,
				paddingRight: 1,
			}}
		>
			<box onMouseDown={toggle} style={{ flexDirection: "row" }}>
				{inProgress ? <Spinner /> : <text fg={color}>{icon}</text>}
				<text>
					<span fg={colors.green}> {toolName}</span>
					{displayMessage && <span fg={colors.muted}> {displayMessage}</span>}
					{canToggle && (
						<span fg={colors.border}>
							{" "}
							({expanded ? "collapse" : "expand"})
						</span>
					)}
				</text>
			</box>

			{isExpanded && hasDetails && (
				<box style={{ flexDirection: "column", marginTop: 1 }}>
					{hasInput && (
						<box style={{ flexDirection: "column" }}>
							<text fg={colors.muted}>Input:</text>
							<text fg={colors.text}>{formatValue(input, 500)}</text>
						</box>
					)}

					{hasOutput && (
						<box style={{ flexDirection: "column" }}>
							<text fg={colors.muted}>Output:</text>
							<text fg={colors.text}>{formatValue(output, 500)}</text>
						</box>
					)}

					{toolError && (
						<box style={{ flexDirection: "column" }}>
							<text fg="#ef4444">Error: {toolError}</text>
						</box>
					)}
				</box>
			)}

			{isFirstPending && (
				<box style={{ flexDirection: "row", marginTop: 1, gap: 1 }}>
					<box
						onMouseDown={() => handleToolApproval(true)}
						style={{
							border: true,
							borderStyle: "heavy",
							borderColor: colors.green,
							paddingLeft: 1,
							paddingRight: 1,
						}}
					>
						<text fg={colors.green}>⌥ Y Approve</text>
					</box>
					<box
						onMouseDown={() => handleToolApproval(false)}
						style={{
							border: true,
							borderStyle: "heavy",
							borderColor: "#ef4444",
							paddingLeft: 1,
							paddingRight: 1,
						}}
					>
						<text fg="#ef4444">⌥ N Deny</text>
					</box>
				</box>
			)}
		</box>
	)
}
