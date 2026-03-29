import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
	chats: defineTable({
		userId: v.string(),
		agentId: v.string(),
		title: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_user_updated_at", ["userId", "updatedAt"])
		.index("by_user_agent_updated_at", ["userId", "agentId", "updatedAt"])
		.index("by_agent_updated_at", ["agentId", "updatedAt"])
		.index("by_updated_at", ["updatedAt"]),

	messages: defineTable({
		userId: v.string(),
		chatId: v.id("chats"),
		role: v.union(v.literal("user"), v.literal("assistant")),
		content: v.string(),
		createdAt: v.number(),
	})
		.index("by_user_chat_created_at", ["userId", "chatId", "createdAt"])
		.index("by_chat_created_at", ["chatId", "createdAt"])
		.index("by_created_at", ["createdAt"]),
})
