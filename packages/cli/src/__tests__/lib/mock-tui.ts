import type { MockInstance } from "vitest"
import { vi } from "vitest"

// Custom error class to identify process.exit calls
export class ProcessExitError extends Error {
	constructor(public exitCode: number) {
		super(`process.exit(${exitCode})`)
		this.name = "ProcessExitError"
	}
}

// Mock functions for TUI module
export const mockRunTui: MockInstance = vi.fn().mockResolvedValue(undefined)
export const mockDiscoverAgents: MockInstance = vi.fn().mockResolvedValue([])

// Mock functions for dependencies
export const mockGetConfig: MockInstance = vi.fn()
export const mockPerformRemoteSync: MockInstance = vi.fn().mockResolvedValue({
	success: true,
	cancelled: false,
	plan: { needsSync: false, toSync: [], dependencies: [], devDependencies: [] },
})
export const mockGetCachedItemsPaths: MockInstance = vi.fn().mockReturnValue({
	agents: "/cache/agents",
	tools: "/cache/tools",
	prompts: "/cache/prompts",
})

// Mock logger
export const mockLogger: Record<string, MockInstance> = {
	info: vi.fn(),
	error: vi.fn(),
	success: vi.fn(),
	warn: vi.fn(),
	break: vi.fn(),
}

// Mock handleError - re-throws ProcessExitError to propagate the exit signal
export const mockHandleError: MockInstance = vi.fn((error: unknown) => {
	if (error instanceof Error && error.name === "ProcessExitError") {
		throw error
	}
})

// Store original process.exit
const originalProcessExit = process.exit

// Mock process.exit to throw an error (simulating actual exit behavior)
export function mockProcessExit(): void {
	process.exit = vi.fn((code?: number) => {
		throw new ProcessExitError(code ?? 0)
	}) as unknown as typeof process.exit
}

// Restore process.exit
export function restoreProcessExit(): void {
	process.exit = originalProcessExit
}

// Reset all mocks to default state
export function resetAllMocks(): void {
	vi.clearAllMocks()
	mockRunTui.mockResolvedValue(undefined)
	mockDiscoverAgents.mockResolvedValue([])
	mockGetConfig.mockResolvedValue(null)
	mockPerformRemoteSync.mockResolvedValue({
		success: true,
		cancelled: false,
		plan: {
			needsSync: false,
			toSync: [],
			dependencies: [],
			devDependencies: [],
		},
	})
	mockGetCachedItemsPaths.mockReturnValue({
		agents: "/cache/agents",
		tools: "/cache/tools",
		prompts: "/cache/prompts",
	})
}

// Helper to create a valid config mock
export function createMockConfig(
	overrides: {
		agents?: string | null
		tools?: string | null
		prompts?: string | null
	} = {},
): {
	resolvedPaths: {
		cwd: string
		agents: string | null
		tools: string | null
		prompts: string | null
	}
} {
	return {
		resolvedPaths: {
			cwd: "/test",
			agents:
				overrides.agents === undefined ? "/test/agents" : overrides.agents,
			tools: overrides.tools === undefined ? "/test/tools" : overrides.tools,
			prompts:
				overrides.prompts === undefined ? "/test/prompts" : overrides.prompts,
		},
	}
}

// Helper to create mock agents
export function createMockAgents(
	names: string[],
): Array<{ name: string; path: string }> {
	return names.map((name) => ({
		name,
		path: `/test/agents/${name}.ts`,
	}))
}
