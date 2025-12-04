import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	createMockConfig,
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
import { exec } from "../commands/exec"

describe("exec command", () => {
	beforeEach(() => {
		resetAllMocks()
		mockProcessExit()
	})

	afterEach(() => {
		restoreProcessExit()
	})

	describe("validation errors", () => {
		it("exits with error when --remote used without agent name", async () => {
			await expect(
				exec.parseAsync(["bun", "test", "my-prompt", "--remote"]),
			).rejects.toThrow(ProcessExitError)

			expect(mockLogger.error).toHaveBeenCalledWith(
				"An agent name is required when using --remote or --remote-only.",
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("exits with error when --remote-only used without agent name", async () => {
			await expect(
				exec.parseAsync(["bun", "test", "my-prompt", "--remote-only"]),
			).rejects.toThrow(ProcessExitError)

			expect(mockLogger.error).toHaveBeenCalledWith(
				"An agent name is required when using --remote or --remote-only.",
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("exits with error when no config found", async () => {
			mockGetConfig.mockResolvedValue(null)

			await expect(
				exec.parseAsync(["bun", "test", "my-prompt"]),
			).rejects.toThrow(ProcessExitError)

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining("agents.json not found"),
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("exits with error when agents path cannot be resolved", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig({ agents: null }))

			await expect(
				exec.parseAsync(["bun", "test", "my-prompt"]),
			).rejects.toThrow(ProcessExitError)

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Could not resolve agents path from agents.json",
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("exits with error when prompts path cannot be resolved", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig({ prompts: null }))

			await expect(
				exec.parseAsync(["bun", "test", "my-prompt"]),
			).rejects.toThrow(ProcessExitError)

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Could not resolve prompts path from agents.json",
			)
			expect(process.exit).toHaveBeenCalledWith(1)
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
				exec.parseAsync(["node", "test", "my-prompt", "my-agent", "--remote"]),
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
				exec.parseAsync(["node", "test", "my-prompt", "my-agent", "--remote"]),
			).rejects.toThrow(ProcessExitError)

			expect(process.exit).toHaveBeenCalledWith(1)
			expect(mockRunTui).not.toHaveBeenCalled()
		})

		it("syncs both prompt and agent in remote mode", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig())

			await exec.parseAsync([
				"node",
				"test",
				"my-prompt",
				"my-agent",
				"--remote",
				"--yes",
			])

			expect(mockPerformRemoteSync).toHaveBeenCalledWith(
				[
					{ name: "my-prompt", type: "prompts" },
					{ name: "my-agent", type: "agents" },
				],
				{ yes: true },
			)
		})
	})

	describe("runTui invocation with remote options", () => {
		it("calls runTui with remote paths only when --remote-only", async () => {
			await exec.parseAsync([
				"node",
				"test",
				"my-prompt",
				"my-agent",
				"--remote-only",
			])

			expect(mockRunTui).toHaveBeenCalledWith({
				agentPaths: ["/cache/agents"],
				promptsPaths: ["/cache/prompts"],
				promptName: "my-prompt",
				initialAgent: "my-agent",
				cwd: expect.any(String),
			})
		})

		it("calls runTui with remote paths when --remote and no local config", async () => {
			mockGetConfig.mockResolvedValue(null)

			await exec.parseAsync([
				"node",
				"test",
				"my-prompt",
				"my-agent",
				"--remote",
			])

			expect(mockRunTui).toHaveBeenCalledWith({
				agentPaths: ["/cache/agents"],
				promptsPaths: ["/cache/prompts"],
				promptName: "my-prompt",
				initialAgent: "my-agent",
				cwd: expect.any(String),
			})
		})
	})

	describe("runTui invocation with local config", () => {
		it("calls runTui with local paths only (default)", async () => {
			mockGetConfig.mockResolvedValue(
				createMockConfig({ agents: "/my/agents", prompts: "/my/prompts" }),
			)

			await exec.parseAsync(["bun", "test", "my-prompt"])

			expect(mockRunTui).toHaveBeenCalledWith({
				agentPaths: ["/my/agents"],
				promptsPaths: ["/my/prompts"],
				promptName: "my-prompt",
				initialAgent: undefined,
				cwd: expect.any(String),
			})
		})

		it("calls runTui with local + remote paths when --remote", async () => {
			mockGetConfig.mockResolvedValue(
				createMockConfig({ agents: "/my/agents", prompts: "/my/prompts" }),
			)

			await exec.parseAsync([
				"node",
				"test",
				"my-prompt",
				"my-agent",
				"--remote",
			])

			expect(mockRunTui).toHaveBeenCalledWith({
				agentPaths: ["/my/agents", "/cache/agents"],
				promptsPaths: ["/my/prompts", "/cache/prompts"],
				promptName: "my-prompt",
				initialAgent: "my-agent",
				cwd: expect.any(String),
			})
		})

		it("passes promptName to runTui", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig())

			await exec.parseAsync(["bun", "test", "specific-prompt"])

			expect(mockRunTui).toHaveBeenCalledWith(
				expect.objectContaining({
					promptName: "specific-prompt",
				}),
			)
		})

		it("passes initialAgent to runTui when provided", async () => {
			mockGetConfig.mockResolvedValue(createMockConfig())

			await exec.parseAsync(["bun", "test", "my-prompt", "specific-agent"])

			expect(mockRunTui).toHaveBeenCalledWith(
				expect.objectContaining({
					initialAgent: "specific-agent",
				}),
			)
		})
	})
})
