import { useAtom } from "@lfades/atom"
import type { KeyEvent, ScrollBoxRenderable } from "@opentui/core"
import { useEffect, useRef } from "react"
import { colors } from "../theme"
import { startNewChat, syncConversationMessages } from "../utils/agent"
import { saveWorkspaceSettings } from "../utils/settings"
import { deleteChat, listChats, loadChat } from "../utils/storage"
import {
	chatListAtom,
	currentChatIdAtom,
	inputAtom,
	selectedChatIndexAtom,
	setMessages,
	showAlert,
	showChatPickerAtom,
} from "./atoms"
import { Dialog, DialogText, DialogTitle } from "./ui/dialog"

function formatDate(timestamp: number): string {
	const date = new Date(timestamp)
	const now = new Date()
	const isToday = date.toDateString() === now.toDateString()

	if (isToday) {
		return date.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		})
	}
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function ChatPicker() {
	const [chats] = useAtom(chatListAtom)
	const [selectedIndex] = useAtom(selectedChatIndexAtom)
	const [currentChatId] = useAtom(currentChatIdAtom)
	const scrollRef = useRef<ScrollBoxRenderable>(null)
	const panelWidth = 60
	const panelHeight = Math.min(chats.length + 6, 20)

	// Load chats when picker opens
	useEffect(() => {
		listChats().then((loadedChats) => {
			chatListAtom.set(
				loadedChats.map((c) => ({
					id: c.id,
					title: c.title,
					updatedAt: c.updatedAt,
				})),
			)
		})
	}, [])

	// Auto-scroll to keep selected item visible
	useEffect(() => {
		if (scrollRef.current && chats.length > 0) {
			const visibleItems = panelHeight - 6
			const scrollTop = Math.max(0, selectedIndex - visibleItems + 1)
			scrollRef.current.scrollTo(scrollTop)
		}
	}, [selectedIndex, chats.length, panelHeight])

	// Refocus input when picker closes
	useEffect(() => {
		return () => {
			inputAtom.get()?.focus()
		}
	}, [])

	if (chats.length === 0) {
		return (
			<Dialog width={panelWidth}>
				<DialogTitle color={colors.pink}>Chat History</DialogTitle>
				<DialogText muted>No previous chats found.</DialogText>
			</Dialog>
		)
	}

	return (
		<Dialog width={panelWidth} height={panelHeight} maxHeight={20}>
			<DialogTitle
				color={colors.pink}
				hint="↑↓ navigate, Enter select, d delete"
			>
				Chat History
			</DialogTitle>
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
							foregroundColor: colors.pink,
							backgroundColor: colors.bgLight,
						},
					},
				}}
				focused
			>
				{chats.map((chat, i) => (
					<box
						key={chat.id}
						style={{
							height: 1,
							backgroundColor: i === selectedIndex ? colors.bgLight : colors.bg,
							paddingLeft: 1,
							paddingRight: 1,
						}}
					>
						<text>
							<span fg={i === selectedIndex ? colors.text : colors.muted}>
								{chat.id === currentChatId ? "● " : "  "}
							</span>
							<span fg={i === selectedIndex ? colors.pink : colors.text}>
								{chat.title}
							</span>
							<span fg={colors.muted}> {formatDate(chat.updatedAt)}</span>
						</text>
					</box>
				))}
			</scrollbox>
		</Dialog>
	)
}

export async function selectChat(chatId: string) {
	const chat = await loadChat(chatId)
	if (chat) {
		currentChatIdAtom.set(chat.id)
		setMessages(chat.messages)
		// Sync conversation messages from loaded UI messages instead of resetting
		// This ensures tool calls and results are properly reconstructed
		syncConversationMessages()
		saveWorkspaceSettings({ lastChatId: chat.id })
	}
}

async function deleteSelectedChat() {
	const chats = chatListAtom.get()
	const selectedIndex = selectedChatIndexAtom.get()
	const selectedChat = chats[selectedIndex]

	if (!selectedChat) return

	const currentChatId = currentChatIdAtom.get()
	const isDeletingCurrentChat = selectedChat.id === currentChatId

	// Delete the chat from storage
	await deleteChat(selectedChat.id)

	// Remove from list
	const updatedChats = chats.filter((c) => c.id !== selectedChat.id)
	chatListAtom.set(updatedChats)

	// Adjust selected index if needed
	if (updatedChats.length === 0) {
		// No more chats, close picker and start new chat
		showChatPickerAtom.set(false)
		selectedChatIndexAtom.set(0)
		if (isDeletingCurrentChat) {
			await startNewChat()
		}
	} else {
		// Keep index in bounds
		const newIndex = Math.min(selectedIndex, updatedChats.length - 1)
		selectedChatIndexAtom.set(newIndex)

		// If we deleted the current chat, switch to another one
		if (isDeletingCurrentChat) {
			const nextChat = updatedChats[newIndex]
			if (nextChat) {
				await selectChat(nextChat.id)
			}
		}
	}

	showAlert("Chat deleted")
}

export function handleChatPickerKey(key: KeyEvent): boolean {
	const showPicker = showChatPickerAtom.get()
	if (!showPicker) return false

	const chats = chatListAtom.get()
	const selectedIndex = selectedChatIndexAtom.get()

	switch (key.name) {
		case "up":
			selectedChatIndexAtom.set(
				selectedIndex > 0 ? selectedIndex - 1 : chats.length - 1,
			)
			return true

		case "down":
			selectedChatIndexAtom.set(
				selectedIndex < chats.length - 1 ? selectedIndex + 1 : 0,
			)
			return true

		case "return": {
			const selectedChat = chats[selectedIndex]
			if (selectedChat) {
				showChatPickerAtom.set(false)
				selectedChatIndexAtom.set(0)
				selectChat(selectedChat.id)
			}
			return true
		}

		case "d":
			deleteSelectedChat()
			return true

		case "escape":
			showChatPickerAtom.set(false)
			selectedChatIndexAtom.set(0)
			return true

		default:
			return false
	}
}
