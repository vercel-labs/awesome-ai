import { useKeyboard } from "@opentui/react"
import { useCallback } from "react"
import { colors } from "../theme"
import { useAgentActions } from "../utils/agent"
import {
	useAppAtoms,
	useCurrentAgent,
	useExecPrompt,
	useShowShortcuts,
} from "./atoms"
import { Footer } from "./footer"
import { Header } from "./header"
import { Markdown } from "./markdown"
import { ShortcutsPanel } from "./shortcuts-panel"
import { AlertContainer } from "./ui/alert"

interface ApprovalButtonsProps {
	onApprove: () => void
	onDeny: () => void
}

function ApprovalButtons({ onApprove, onDeny }: ApprovalButtonsProps) {
	return (
		<box
			style={{
				height: 3,
				flexDirection: "row",
				justifyContent: "center",
				alignItems: "center",
				gap: 2,
			}}
		>
			<box
				style={{
					paddingLeft: 2,
					paddingRight: 2,
					border: true,
					borderColor: colors.green,
				}}
				onMouseDown={onApprove}
			>
				<text>
					<span fg={colors.green}>⌥ Y</span>
					<span fg={colors.text}> Approve</span>
				</text>
			</box>
			<box
				style={{
					paddingLeft: 2,
					paddingRight: 2,
					border: true,
					borderColor: colors.pink,
				}}
				onMouseDown={onDeny}
			>
				<text>
					<span fg={colors.pink}>⌥ N</span>
					<span fg={colors.text}> Deny</span>
				</text>
			</box>
		</box>
	)
}

export interface PromptApprovalProps {
	onApprove: () => void
	onDeny: () => void
}

export function PromptApproval({ onApprove, onDeny }: PromptApprovalProps) {
	const [execPrompt] = useExecPrompt()
	const [currentAgent] = useCurrentAgent()
	const [showShortcuts, setShowShortcuts] = useShowShortcuts()

	useKeyboard((key) => {
		// Alt+Y to approve
		if (key.name === "y" && (key.meta || key.option)) {
			key.preventDefault()
			onApprove()
			return
		}

		// Alt+N to deny
		if (key.name === "n" && (key.meta || key.option)) {
			key.preventDefault()
			onDeny()
			return
		}

		// Alt+S to toggle shortcuts panel
		if (key.name === "s" && (key.meta || key.option)) {
			key.preventDefault()
			setShowShortcuts(!showShortcuts)
			return
		}

		// Escape to close shortcuts panel
		if (key.name === "escape" && showShortcuts) {
			key.preventDefault()
			setShowShortcuts(false)
			return
		}

		// Ctrl+C to exit (deny)
		if (key.name === "c" && key.ctrl) {
			key.preventDefault()
			onDeny()
			return
		}
	})

	return (
		<box
			style={{
				flexDirection: "column",
				width: "100%",
				height: "100%",
				backgroundColor: colors.bg,
			}}
		>
			<Header agentName={currentAgent || "no agent"} />

			{/* Prompt title */}
			<box
				style={{
					paddingLeft: 1,
					paddingRight: 1,
					height: 2,
				}}
			>
				<text>
					<span fg={colors.muted}>Prompt: </span>
					<span fg={colors.green}>{execPrompt?.name || "unknown"}</span>
					<span fg={colors.muted}> │ Review and approve to execute</span>
				</text>
			</box>

			{/* Scrollable prompt content */}
			<scrollbox
				style={{
					flexGrow: 1,
					paddingLeft: 1,
					paddingRight: 1,
					paddingTop: 1,
				}}
				stickyScroll={false}
			>
				{execPrompt?.content ? (
					<Markdown>{execPrompt.content}</Markdown>
				) : (
					<text fg={colors.muted}>No prompt content loaded.</text>
				)}
			</scrollbox>

			<ApprovalButtons onApprove={onApprove} onDeny={onDeny} />

			<Footer />

			{showShortcuts && <ShortcutsPanel />}
			<AlertContainer />
		</box>
	)
}

/**
 * Handle prompt approval: switch to chat mode and send the prompt
 */
export function usePromptApprovalHandler() {
	const atoms = useAppAtoms()
	const agent = useAgentActions()

	return useCallback(async () => {
		const execPrompt = atoms.execPromptAtom.get()

		if (!execPrompt) {
			return
		}

		// Switch to chat mode (agent is already set)
		atoms.execModeAtom.set(false)

		// Small delay to let the UI switch before sending the message
		await new Promise((resolve) => setTimeout(resolve, 50))

		// Send the prompt as the first user message
		await agent.sendMessage(execPrompt.content)
	}, [agent, atoms])
}
