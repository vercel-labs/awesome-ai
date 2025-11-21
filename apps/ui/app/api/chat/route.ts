import { NextResponse } from "next/server"
import { deleteChat } from "@/app/(chat)/actions"

export async function DELETE(request: Request) {
	const { searchParams } = new URL(request.url)
	const id = searchParams.get("id")

	if (!id) {
		return NextResponse.json({ error: "Chat ID is required" }, { status: 400 })
	}

	try {
		await deleteChat({ id })
		return NextResponse.json({ success: true })
	} catch (error) {
		console.error("Error deleting chat:", error)
		return NextResponse.json(
			{ error: "Failed to delete chat" },
			{ status: 500 },
		)
	}
}
