import { useCallback, useState } from "react"
import { COMMANDS } from "../commands"
import { colors } from "../theme"
import { createSystemMessage, type TUIMessage } from "../types"
import { useAgentActions } from "../utils/agent"
import { copyToClipboard } from "../utils/clipboard"
import {
	useAppActions,
	useAppAtoms,
	useCommandFilter,
	useIsLoading,
	useSelectedCommand,
	useShowCommands,
} from "./atoms"

const chatKeyBindings = [
	{ name: "return", action: "submit" as const },
	{ name: "return", shift: true, action: "newline" as const },
]

// Max lines before scrolling within textarea
const MAX_INPUT_LINES = 10

function useCommandExecutor() {
	const actions = useAppActions()
	const atoms = useAppAtoms()
	const agent = useAgentActions()

	return useCallback(
		(commandName: string) => {
			const addSystemMsg = (content: string) => {
				actions.addMessage(createSystemMessage(content))
			}

			const currentAgent = atoms.currentAgentAtom.get()

			switch (commandName) {
				case "/new":
					agent.startNewChat()
					actions.showAlert("New chat started")
					break
				case "/history":
					atoms.showChatPickerAtom.set(true)
					break
				case "/agent":
					atoms.showAgentSelectorAtom.set(true)
					break
				case "/model":
					atoms.showModelSelectorAtom.set(true)
					break
				case "/help":
					addSystemMsg(
						`Available commands:\n${COMMANDS.map((c) => `  ${c.name} - ${c.description}`).join("\n")}`,
					)
					break
				case "/clear":
					actions.clearMessages()
					actions.addMessage(createSystemMessage("Terminal cleared."))
					agent.resetConversation()
					break
				case "/summarize":
					addSystemMsg("Summarizing conversation... (not implemented)")
					break
				case "/export": {
					const messages = atoms.messagesAtom.get().reduce<TUIMessage[]>((acc, atom) => {
						const msg = atom.get()
						if (msg.role !== "system") acc.push(msg)
						return acc
					}, [])

					if (messages.length === 0) {
						addSystemMsg("No messages to export.")
						break
					}

					const json = JSON.stringify(messages, null, 2)

					copyToClipboard(json).then((success) => {
						if (success) {
							actions.showAlert("Chat saved to clipboard")
						} else {
							actions.showAlert("Failed to export", "error")
						}
					})
					break
				}
				case "/time":
					addSystemMsg(`Current time: ${new Date().toLocaleString()}`)
					break
				case "/version": {
					const model = atoms.selectedModelAtom.get()
					addSystemMsg(`Agent: ${currentAgent || "none"}\nModel: ${model}\nVersion: 1.0.0`)
					break
				}
				default:
					addSystemMsg(`Unknown command: ${commandName}`)
			}
		},
		[actions, agent, atoms],
	)
}

export function InputArea() {
	const [showCommands, setShowCommands] = useShowCommands()
	const [commandFilter, setCommandFilter] = useCommandFilter()
	const [selectedCommand, setSelectedCommand] = useSelectedCommand()
	const [isLoading] = useIsLoading()
	const actions = useAppActions()
	const atoms = useAppAtoms()
	const agent = useAgentActions()
	const executeCommand = useCommandExecutor()
	const [lineCount, setLineCount] = useState(1)
	const filteredCommands = COMMANDS.filter((cmd) =>
		cmd.name.toLowerCase().includes(commandFilter.toLowerCase()),
	)
	const handleSubmit = async () => {
		const input = atoms.inputAtom.get()
		if (!input) return

		const value = input.plainText
		if (!value.trim() || isLoading) return

		input.setText("")
		setLineCount(1)
		setShowCommands(false)
		setCommandFilter("")
		setSelectedCommand(0)

		// Reset scroll to bottom when sending a new message
		actions.scrollToBottom()

		if (value.startsWith("/")) {
			const commandName = value.split(" ")[0]!
			executeCommand(commandName)
			return
		}

		await agent.sendMessage(value)
	}

	const handleInputChange = (value: string) => {
		if (value.startsWith("/")) {
			if (!showCommands) {
				setSelectedCommand(0)
			}
			setShowCommands(true)
			setCommandFilter(value)
		} else {
			setShowCommands(false)
			setCommandFilter("")
			setSelectedCommand(0)
		}

		const input = atoms.inputAtom.get()
		if (!input) return

		setLineCount(Math.min(Math.max(1, input.lineCount), MAX_INPUT_LINES))
	}

	const selectCommand = (index: number) => {
		const command = filteredCommands[index]
		const input = atoms.inputAtom.get()
		if (command && input) {
			input.setText(`${command.name} `)
			input.gotoBufferEnd()
			setShowCommands(false)
			setCommandFilter("")
			setSelectedCommand(0)
		}
	}

	const navigateUp = () => {
		const newVal = selectedCommand > 0 ? selectedCommand - 1 : filteredCommands.length - 1
		setSelectedCommand(newVal)
	}

	const navigateDown = () => {
		const newVal = selectedCommand < filteredCommands.length - 1 ? selectedCommand + 1 : 0
		setSelectedCommand(newVal)
	}

	const closeCommands = () => {
		setShowCommands(false)
		setCommandFilter("")
		atoms.inputAtom.get()?.setText("")
	}

	// Height = lines + 2 for border
	const boxHeight = lineCount + 2

	return (
		<box
			onMouseDown={() => {
				atoms.inputAtom.get()?.focus()
			}}
			style={{
				height: boxHeight,
				border: true,
				borderStyle: "single",
				borderColor: showCommands ? colors.green : colors.border,
				paddingLeft: 1,
				flexDirection: "row",
				alignItems: "flex-start",
			}}
		>
			{isLoading ? (
				<text
					fg={colors.pink}
					style={{ width: 2, height: 1 }}
					onMouseDown={(e) => {
						e.stopPropagation()
						agent.stopGeneration()
					}}
				>
					■
				</text>
			) : (
				<text fg={colors.green} style={{ width: 2, height: 1 }}>
					❯
				</text>
			)}
			<textarea
				ref={(ref) => atoms.inputAtom.set(ref)}
				placeholder={isLoading ? "⌥ X to stop" : "Enter prompt, / for commands"}
				focused
				wrapMode="word"
				keyBindings={chatKeyBindings}
				onSubmit={handleSubmit}
				onMouseScroll={(event) => {
					const input = atoms.inputAtom.get()
					if (!input || !event.scroll) return

					// Move cursor to scroll the view (works regardless of line count)
					const scrollAmount = Math.abs(event.scroll.delta) || 1
					for (let i = 0; i < scrollAmount; i++) {
						if (event.scroll.direction === "up") {
							input.moveCursorUp()
						} else if (event.scroll.direction === "down") {
							input.moveCursorDown()
						}
					}
				}}
				onContentChange={() => {
					// Recalculate size when content changes (typing, paste, etc.)
					const input = atoms.inputAtom.get()
					if (input) {
						handleInputChange(input.plainText)
					}
				}}
				onKeyDown={(key) => {
					if (showCommands && filteredCommands.length > 0) {
						if (key.name === "up") {
							key.preventDefault()
							navigateUp()
							return
						}
						if (key.name === "down") {
							key.preventDefault()
							navigateDown()
							return
						}
						if (key.name === "tab" || key.name === "return") {
							key.preventDefault()
							selectCommand(selectedCommand)
							return
						}
						if (key.name === "escape") {
							key.preventDefault()
							closeCommands()
							return
						}
					}

					// Delete word with option/alt + backspace
					if (key.name === "backspace" && (key.option || key.meta)) {
						key.preventDefault()
						const input = atoms.inputAtom.get()
						if (input) {
							input.deleteWordBackward()
						}
					}
				}}
				backgroundColor={colors.bg}
				focusedBackgroundColor={colors.bg}
				textColor={colors.text}
				focusedTextColor={colors.text}
				style={{ flexGrow: 1, maxHeight: MAX_INPUT_LINES }}
			/>
		</box>
	)
}
