import { NextResponse } from "next/server"
import { deleteAllChats, getChatHistory } from "@/app/(chat)/actions"

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url)
	const limit = Number.parseInt(searchParams.get("limit") || "20", 10)
	const endingBefore = searchParams.get("ending_before") || undefined

	try {
		const history = await getChatHistory(endingBefore, limit)
		return NextResponse.json(history)
	} catch (error) {
		console.error("Error fetching chat history:", error)
		return NextResponse.json(
			{ error: "Failed to fetch chat history" },
			{ status: 500 },
		)
	}
}

export async function DELETE() {
	try {
		await deleteAllChats()
		return NextResponse.json({ success: true })
	} catch (error) {
		console.error("Error deleting all chats:", error)
		return NextResponse.json(
			{ error: "Failed to delete all chats" },
			{ status: 500 },
		)
	}
}
