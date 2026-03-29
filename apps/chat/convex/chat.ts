import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"

const user = async (ctx: MutationCtx | QueryCtx) => {
	const identity = await ctx.auth.getUserIdentity()
	if (!identity) {
		throw new Error("Unauthenticated")
	}
	return identity.subject ?? identity.tokenIdentifier
}

const chat = async (ctx: MutationCtx | QueryCtx, id: Id<"chats">, uid: string) => {
	const item = await ctx.db.get(id)
	if (!item || item.userId !== uid) {
		throw new Error("Forbidden")
	}
	return item
}

export const listChats = query({
	args: {
		agentId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const uid = await user(ctx)
		if (args.agentId) {
			return await ctx.db
				.query("chats")
				.withIndex("by_user_agent_updated_at", (q) =>
					q.eq("userId", uid).eq("agentId", args.agentId!),
				)
				.order("desc")
				.collect()
		}

		return await ctx.db
			.query("chats")
			.withIndex("by_user_updated_at", (q) => q.eq("userId", uid))
			.order("desc")
			.collect()
	},
})

export const listMessages = query({
	args: {
		chatId: v.id("chats"),
	},
	handler: async (ctx, args) => {
		const uid = await user(ctx)
		await chat(ctx, args.chatId, uid)
		return await ctx.db
			.query("messages")
			.withIndex("by_user_chat_created_at", (q) => q.eq("userId", uid).eq("chatId", args.chatId))
			.order("asc")
			.collect()
	},
})

export const createChat = mutation({
	args: {
		agentId: v.string(),
		title: v.string(),
	},
	handler: async (ctx, args) => {
		const now = Date.now()
		const uid = await user(ctx)
		return await ctx.db.insert("chats", {
			userId: uid,
			agentId: args.agentId,
			title: args.title,
			createdAt: now,
			updatedAt: now,
		})
	},
})

export const appendMessage = mutation({
	args: {
		chatId: v.id("chats"),
		role: v.union(v.literal("user"), v.literal("assistant")),
		content: v.string(),
	},
	handler: async (ctx, args) => {
		const now = Date.now()
		const uid = await user(ctx)
		await chat(ctx, args.chatId, uid)
		const id = await ctx.db.insert("messages", {
			userId: uid,
			chatId: args.chatId,
			role: args.role,
			content: args.content,
			createdAt: now,
		})

		await ctx.db.patch(args.chatId, {
			updatedAt: now,
		})

		return id
	},
})

export const renameChat = mutation({
	args: {
		chatId: v.id("chats"),
		title: v.string(),
	},
	handler: async (ctx, args) => {
		const uid = await user(ctx)
		await chat(ctx, args.chatId, uid)
		await ctx.db.patch(args.chatId, {
			title: args.title,
			updatedAt: Date.now(),
		})
	},
})

export const deleteChat = mutation({
	args: {
		chatId: v.id("chats"),
	},
	handler: async (ctx, args) => {
		const uid = await user(ctx)
		await chat(ctx, args.chatId, uid)
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_user_chat_created_at", (q) => q.eq("userId", uid).eq("chatId", args.chatId))
			.collect()
		await Promise.all(messages.map((item) => ctx.db.delete(item._id)))

		await ctx.db.delete(args.chatId)
	},
})
