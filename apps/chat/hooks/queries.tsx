"use client"

import { createQuery } from "@/hooks/create-query"
import { api } from "@/convex/_generated/api"

const auth = createQuery(api.auth.getAuth)

export const useAuth = auth.useQuery
export const AuthQuery = auth.Provider
