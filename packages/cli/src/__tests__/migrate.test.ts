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
import { migrate } from "../commands/migrate"

describe("migrate command", () => {
	beforeEach(() => {
		resetAllMocks()
		mockProcessExit()
	})

	afterEach(() => {
		restoreProcessExit()
	})

	describe("validation errors", () => {
		it("exits with error when no config found", async () => {
			mockGetConfig.mockResolvedValue(null)

			await expect(
				migrate.parseAsync(["bun", "test", "my-migration"]),
			).rejects.toThrow(ProcessExitError)

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining("agents.json not found"),
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("exits with error when agents path cannot be resolved", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig({ agents: null }))

			await expect(
				migrate.parseAsync(["bun", "test", "my-migration"]),
			).rejects.toThrow(ProcessExitError)

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Could not resolve agents path from agents.json",
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("exits with error when prompts path cannot be resolved", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig({ prompts: null }))

			await expect(
				migrate.parseAsync(["bun", "test", "my-migration"]),
			).rejects.toThrow(ProcessExitError)

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Could not resolve prompts path from agents.json",
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})
	})

	describe("required agents validation", () => {
		it("exits with error when required agents are missing (none found)", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig())
			mockDiscoverAgents.mockResolvedValue([])

			await expect(
				migrate.parseAsync(["bun", "test", "my-migration"]),
			).rejects.toThrow(ProcessExitError)

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining("Missing required agents"),
			)
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining("migration-planning-agent"),
			)
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining("migration-agent"),
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("exits with error when required agents are missing (partial)", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig())
			mockDiscoverAgents.mockResolvedValue(
				createMockAgents(["migration-planning-agent"]),
			)

			await expect(
				migrate.parseAsync(["bun", "test", "my-migration"]),
			).rejects.toThrow(ProcessExitError)

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining("Missing required agents"),
			)
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining("migration-agent"),
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("shows correct suggestion in error without --remote", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig())
			mockDiscoverAgents.mockResolvedValue([])

			await expect(
				migrate.parseAsync(["bun", "test", "my-migration"]),
			).rejects.toThrow(ProcessExitError)

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining("awesome-ai add"),
			)
		})

		it("shows correct suggestion in error when --remote was used", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig())
			mockDiscoverAgents.mockResolvedValue([])

			await expect(
				migrate.parseAsync(["bun", "test", "my-migration", "--remote"]),
			).rejects.toThrow(ProcessExitError)

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining("may not be available in the remote registry"),
			)
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
				migrate.parseAsync(["bun", "test", "my-migration", "--remote"]),
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
				migrate.parseAsync(["bun", "test", "my-migration", "--remote"]),
			).rejects.toThrow(ProcessExitError)

			expect(process.exit).toHaveBeenCalledWith(1)
			expect(mockRunTui).not.toHaveBeenCalled()
		})

		it("syncs prompt and both required agents in remote mode", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig())
			mockDiscoverAgents.mockResolvedValue(
				createMockAgents(["migration-planning-agent", "migration-agent"]),
			)

			await migrate.parseAsync([
				"node",
				"test",
				"my-migration",
				"--remote",
				"--yes",
			])

			expect(mockPerformRemoteSync).toHaveBeenCalledWith(
				[
					{ name: "my-migration", type: "prompts" },
					{ name: "migration-planning-agent", type: "agents" },
					{ name: "migration-agent", type: "agents" },
				],
				{ yes: true },
			)
		})
	})

	describe("runTui invocation with remote options", () => {
		it("calls runTui with remote paths when --remote-only", async () => {
			await migrate.parseAsync([
				"node",
				"test",
				"my-migration",
				"--remote-only",
			])

			expect(mockRunTui).toHaveBeenCalledWith({
				agentPaths: ["/cache/agents"],
				promptsPaths: ["/cache/prompts"],
				promptName: "my-migration",
				initialAgent: "migration-planning-agent",
				cwd: expect.any(String),
			})
		})

		it("calls runTui with remote paths when --remote and no local config", async () => {
			mockGetConfig.mockResolvedValue(null)

			await migrate.parseAsync(["bun", "test", "my-migration", "--remote"])

			expect(mockRunTui).toHaveBeenCalledWith({
				agentPaths: ["/cache/agents"],
				promptsPaths: ["/cache/prompts"],
				promptName: "my-migration",
				initialAgent: "migration-planning-agent",
				cwd: expect.any(String),
			})
		})
	})

	describe("runTui invocation with local config", () => {
		it("calls runTui with local paths only (default)", async () => {
			mockGetConfig.mockResolvedValue(
				createMockConfig({ agents: "/my/agents", prompts: "/my/prompts" }),
			)
			mockDiscoverAgents.mockResolvedValue(
				createMockAgents(["migration-planning-agent", "migration-agent"]),
			)

			await migrate.parseAsync(["bun", "test", "my-migration"])

			expect(mockRunTui).toHaveBeenCalledWith({
				agentPaths: ["/my/agents"],
				promptsPaths: ["/my/prompts"],
				promptName: "my-migration",
				initialAgent: "migration-planning-agent",
				cwd: expect.any(String),
			})
		})

		it("calls runTui with local + remote paths when --remote", async () => {
			mockGetConfig.mockResolvedValue(
				createMockConfig({ agents: "/my/agents", prompts: "/my/prompts" }),
			)
			mockDiscoverAgents.mockResolvedValue(
				createMockAgents(["migration-planning-agent", "migration-agent"]),
			)

			await migrate.parseAsync(["bun", "test", "my-migration", "--remote"])

			expect(mockRunTui).toHaveBeenCalledWith({
				agentPaths: ["/my/agents", "/cache/agents"],
				promptsPaths: ["/my/prompts", "/cache/prompts"],
				promptName: "my-migration",
				initialAgent: "migration-planning-agent",
				cwd: expect.any(String),
			})
		})

		it("calls runTui with migration-planning-agent as initialAgent", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig())
			mockDiscoverAgents.mockResolvedValue(
				createMockAgents(["migration-planning-agent", "migration-agent"]),
			)

			await migrate.parseAsync(["bun", "test", "my-migration"])

			expect(mockRunTui).toHaveBeenCalledWith(
				expect.objectContaining({
					initialAgent: "migration-planning-agent",
				}),
			)
		})
	})
})
