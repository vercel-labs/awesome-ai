"use client"

import { api } from "@/convex/_generated/api"
import { createQuery } from "@/hooks/create-query"

const auth = createQuery(api.auth.getAuth)

export const useAuth = auth.useQuery
export const AuthQuery = auth.Provider
