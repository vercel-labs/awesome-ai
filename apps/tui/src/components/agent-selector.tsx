import type { KeyEvent, ScrollBoxRenderable } from "@opentui/core"
import { useCallback, useEffect, useRef } from "react"
import { colors } from "../theme"
import { saveWorkspaceSettings } from "../utils/settings"
import {
	useAppAtoms,
	useAvailableAgents,
	useCurrentAgent,
	useSelectedAgentIndex,
} from "./atoms"
import { Dialog, DialogSpacer, DialogText, DialogTitle } from "./ui/dialog"

export function AgentSelector() {
	const [agents] = useAvailableAgents()
	const [selectedIndex] = useSelectedAgentIndex()
	const [currentAgent] = useCurrentAgent()
	const atoms = useAppAtoms()
	const scrollRef = useRef<ScrollBoxRenderable>(null)
	const panelHeight = Math.min(agents.length + 6, 20)

	// Auto-scroll to keep selected item visible
	useEffect(() => {
		if (scrollRef.current && agents.length > 0) {
			const visibleItems = panelHeight - 6
			const scrollTop = Math.max(0, selectedIndex - visibleItems + 1)
			scrollRef.current.scrollTo(scrollTop)
		}
	}, [selectedIndex, agents.length, panelHeight])

	// Refocus input when agent selector closes (scrollbox steals focus)
	useEffect(() => {
		return () => {
			atoms.inputAtom.get()?.focus()
		}
	}, [atoms])

	if (agents.length === 0) {
		return (
			<Dialog>
				<DialogTitle color={colors.green}>Select Agent</DialogTitle>
				<DialogText muted>No agents found.</DialogText>
				<DialogText muted>
					Make sure agents.json exists and has agents defined.
				</DialogText>
			</Dialog>
		)
	}

	return (
		<Dialog height={panelHeight} maxHeight={20}>
			<DialogTitle color={colors.green} hint="↑↓ navigate, Enter select, Esc">
				Select Agent
			</DialogTitle>
			{currentAgent && (
				<>
					<text fg={colors.muted}>
						Current: <span fg={colors.green}>{currentAgent}</span>
					</text>
					<DialogSpacer />
				</>
			)}
			<scrollbox
				ref={scrollRef}
				style={{
					flexGrow: 1,
					contentOptions: {
						backgroundColor: colors.bg,
					},
					scrollbarOptions: {
						showArrows: true,
						trackOptions: {
							foregroundColor: colors.green,
							backgroundColor: colors.bgLight,
						},
					},
				}}
				focused
			>
				{agents.map((agent, i) => (
					<box
						key={agent.name}
						style={{
							height: 1,
							backgroundColor:
								i === selectedIndex ? colors.greenDark : colors.bg,
							paddingLeft: 1,
							paddingRight: 1,
						}}
					>
						<text>
							<span fg={i === selectedIndex ? colors.text : colors.muted}>
								{agent.name === currentAgent ? "● " : "  "}
							</span>
							<span fg={i === selectedIndex ? colors.green : colors.text}>
								{agent.name}
							</span>
						</text>
					</box>
				))}
			</scrollbox>
		</Dialog>
	)
}

/**
 * Handle keyboard input for the agent selector.
 * Returns true if the key was handled.
 */
export function useAgentSelectorKeyHandler() {
	const atoms = useAppAtoms()

	return useCallback(
		(key: KeyEvent): boolean => {
			const showSelector = atoms.showAgentSelectorAtom.get()
			if (!showSelector) return false

			const agents = atoms.availableAgentsAtom.get()
			const selectedIndex = atoms.selectedAgentIndexAtom.get()

			switch (key.name) {
				case "up":
					atoms.selectedAgentIndexAtom.set(
						selectedIndex > 0 ? selectedIndex - 1 : agents.length - 1,
					)
					return true

				case "down":
					atoms.selectedAgentIndexAtom.set(
						selectedIndex < agents.length - 1 ? selectedIndex + 1 : 0,
					)
					return true

				case "return": {
					const selectedAgent = agents[selectedIndex]
					if (selectedAgent) {
						atoms.currentAgentAtom.set(selectedAgent.name)
						atoms.showAgentSelectorAtom.set(false)
						atoms.selectedAgentIndexAtom.set(0)
						saveWorkspaceSettings(atoms.cwdAtom.get(), {
							selectedAgent: selectedAgent.name,
						})
					}
					return true
				}

				case "escape":
					atoms.showAgentSelectorAtom.set(false)
					atoms.selectedAgentIndexAtom.set(0)
					return true

				default:
					return false
			}
		},
		[atoms],
	)
}
