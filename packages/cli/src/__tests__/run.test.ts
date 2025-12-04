import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	createMockAgents,
	createMockConfig,
	mockDiscoverAgents,
	mockGetCachedItemsPaths,
	mockGetConfig,
	mockHandleError,
	mockLogger,
	mockPerformRemoteSync,
	mockProcessExit,
	mockRunTui,
	ProcessExitError,
	resetAllMocks,
	restoreProcessExit,
} from "./lib/mock-tui"

// Set up module mocks
vi.mock("awesome-ai-tui", () => ({
	runTui: mockRunTui,
	discoverAgents: mockDiscoverAgents,
}))

vi.mock("@/src/utils/get-config", () => ({
	getConfig: mockGetConfig,
}))

vi.mock("@/src/utils/remote-approval", () => ({
	performRemoteSync: mockPerformRemoteSync,
}))

vi.mock("@/src/utils/remote-cache", () => ({
	getCachedItemsPaths: mockGetCachedItemsPaths,
}))

vi.mock("@/src/utils/logger", () => ({
	logger: mockLogger,
}))

vi.mock("@/src/utils/handle-error", () => ({
	handleError: mockHandleError,
}))

// Import after mocks are set up
import { run } from "../commands/run"

describe("run command", () => {
	beforeEach(() => {
		resetAllMocks()
		mockProcessExit()
	})

	afterEach(() => {
		restoreProcessExit()
	})

	describe("validation errors", () => {
		it("exits with error when --remote used without agent name", async () => {
			await expect(run.parseAsync(["bun", "test", "--remote"])).rejects.toThrow(
				ProcessExitError,
			)

			expect(mockLogger.error).toHaveBeenCalledWith(
				"An agent name is required when using --remote or --remote-only.",
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("exits with error when --remote-only used without agent name", async () => {
			await expect(
				run.parseAsync(["bun", "test", "--remote-only"]),
			).rejects.toThrow(ProcessExitError)

			expect(mockLogger.error).toHaveBeenCalledWith(
				"An agent name is required when using --remote or --remote-only.",
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("exits with error when no agent provided and no config", async () => {
			mockGetConfig.mockResolvedValue(null)

			await expect(run.parseAsync(["bun", "test"])).rejects.toThrow(
				ProcessExitError,
			)

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining("agents.json not found"),
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("exits with error when no agent provided and no agents found", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig())
			mockDiscoverAgents.mockResolvedValue([])

			await expect(run.parseAsync(["bun", "test"])).rejects.toThrow(
				ProcessExitError,
			)

			expect(mockLogger.error).toHaveBeenCalledWith(
				"No agents found. Add agents with 'awesome-ai add'.",
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("exits with error when agent provided but no config", async () => {
			mockGetConfig.mockResolvedValue(null)

			await expect(run.parseAsync(["bun", "test", "my-agent"])).rejects.toThrow(
				ProcessExitError,
			)

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining("agents.json not found"),
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("exits with error when agents path cannot be resolved", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig({ agents: null }))

			await expect(run.parseAsync(["bun", "test", "my-agent"])).rejects.toThrow(
				ProcessExitError,
			)

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Could not resolve agents path from agents.json",
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})
	})

	describe("agent listing", () => {
		it("lists available agents when no agent provided with valid config", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig())
			mockDiscoverAgents.mockResolvedValue(
				createMockAgents(["agent-one", "agent-two"]),
			)

			await expect(run.parseAsync(["bun", "test"])).rejects.toThrow(
				ProcessExitError,
			)

			expect(mockLogger.info).toHaveBeenCalledWith("Available agents:")
			expect(mockLogger.info).toHaveBeenCalledWith("  - agent-one")
			expect(mockLogger.info).toHaveBeenCalledWith("  - agent-two")
			expect(mockLogger.info).toHaveBeenCalledWith(
				"Run with: awesome-ai run <agent>",
			)
			expect(process.exit).toHaveBeenCalledWith(0)
		})
	})

	describe("remote sync", () => {
		it("exits gracefully when remote sync is cancelled", async () => {
			mockPerformRemoteSync.mockResolvedValue({
				success: false,
				cancelled: true,
				plan: {
					needsSync: false,
					toSync: [],
					dependencies: [],
					devDependencies: [],
				},
			})

			await expect(
				run.parseAsync(["bun", "test", "my-agent", "--remote"]),
			).rejects.toThrow(ProcessExitError)

			expect(mockLogger.info).toHaveBeenCalledWith("Remote sync cancelled.")
			expect(process.exit).toHaveBeenCalledWith(0)
			expect(mockRunTui).not.toHaveBeenCalled()
		})

		it("exits with error when remote sync fails", async () => {
			mockPerformRemoteSync.mockResolvedValue({
				success: false,
				cancelled: false,
				plan: {
					needsSync: true,
					toSync: [],
					dependencies: [],
					devDependencies: [],
				},
			})

			await expect(
				run.parseAsync(["bun", "test", "my-agent", "--remote"]),
			).rejects.toThrow(ProcessExitError)

			expect(process.exit).toHaveBeenCalledWith(1)
			expect(mockRunTui).not.toHaveBeenCalled()
		})

		it("passes --yes option to performRemoteSync", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig())

			await run.parseAsync(["bun", "test", "my-agent", "--remote", "--yes"])

			expect(mockPerformRemoteSync).toHaveBeenCalledWith(
				[{ name: "my-agent", type: "agents" }],
				{ yes: true },
			)
		})
	})

	describe("runTui invocation with remote options", () => {
		it("calls runTui with remote paths only when --remote-only", async () => {
			await run.parseAsync(["bun", "test", "my-agent", "--remote-only"])

			expect(mockRunTui).toHaveBeenCalledWith({
				agentPaths: ["/cache/agents"],
				initialAgent: "my-agent",
				cwd: expect.any(String),
			})
		})

		it("calls runTui with remote paths when --remote and no local config", async () => {
			mockGetConfig.mockResolvedValue(null)

			await run.parseAsync(["bun", "test", "my-agent", "--remote"])

			expect(mockRunTui).toHaveBeenCalledWith({
				agentPaths: ["/cache/agents"],
				initialAgent: "my-agent",
				cwd: expect.any(String),
			})
		})
	})

	describe("runTui invocation with local config", () => {
		it("calls runTui with local paths only (default)", async () => {
			mockGetConfig.mockResolvedValue(
				createMockConfig({ agents: "/my/agents" }),
			)

			await run.parseAsync(["bun", "test", "my-agent"])

			expect(mockRunTui).toHaveBeenCalledWith({
				agentPaths: ["/my/agents"],
				initialAgent: "my-agent",
				cwd: expect.any(String),
			})
		})

		it("calls runTui with local + remote paths when --remote", async () => {
			mockGetConfig.mockResolvedValue(
				createMockConfig({ agents: "/my/agents" }),
			)

			await run.parseAsync(["bun", "test", "my-agent", "--remote"])

			expect(mockRunTui).toHaveBeenCalledWith({
				agentPaths: ["/my/agents", "/cache/agents"],
				initialAgent: "my-agent",
				cwd: expect.any(String),
			})
		})

		it("passes --cwd option correctly", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig())

			await run.parseAsync([
				"node",
				"test",
				"my-agent",
				"--cwd",
				"/custom/path",
			])

			expect(mockRunTui).toHaveBeenCalledWith(
				expect.objectContaining({
					cwd: expect.stringContaining("/custom/path"),
				}),
			)
		})
	})
})
