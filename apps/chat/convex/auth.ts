import { createClient, type GenericCtx } from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { betterAuth, type BetterAuthOptions } from "better-auth"
import { components } from "./_generated/api"
import { DataModel } from "./_generated/dataModel"
import { internalAction } from "./_generated/server"
import authConfig from "./auth.config"

const site = process.env.SITE_URL!

export const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
	return {
		baseURL: site,
		database: authComponent.adapter(ctx),
		socialProviders: {
			vercel: {
				clientId: process.env.VERCEL_CLIENT_ID as string,
				clientSecret: process.env.VERCEL_CLIENT_SECRET as string,
			},
		},
		plugins: [
			convex({
				authConfig,
				jwks: process.env.JWKS,
			}),
		],
	} satisfies BetterAuthOptions
}

export const createAuth = (ctx: GenericCtx<DataModel>) => {
	return betterAuth(createAuthOptions(ctx))
}

export const { getAuthUser } = authComponent.clientApi()

export const getLatestJwks = internalAction({
	args: {},
	handler: async (ctx) => {
		return await createAuth(ctx).api.getLatestJwks()
	},
})
