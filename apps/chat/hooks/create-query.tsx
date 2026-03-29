"use client"

import { type Preloaded, usePreloadedQuery } from "convex/react"
import { type FunctionReference, getFunctionName } from "convex/server"
import { createContext, type ReactNode, use, useContext } from "react"

export function createQuery<Q extends FunctionReference<"query">>(query: Q) {
	type Data = {
		preloaded: Promise<Preloaded<Q>>
	}

	const Context = createContext<Data | null>(null)

	return {
		useQuery() {
			const context = useContext(Context)
			if (context === null) {
				throw new Error(`Trying to read query ${getFunctionName(query)} without provider`)
			}
			const preloaded = use(context.preloaded)
			return usePreloadedQuery(preloaded)
		},
		Provider({ preloaded, children }: { children: ReactNode; preloaded: Promise<Preloaded<Q>> }) {
			return <Context value={{ preloaded }}>{children}</Context>
		},
	}
}
