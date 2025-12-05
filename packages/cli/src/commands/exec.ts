import { runTui } from "awesome-ai-tui"
import { Command } from "commander"
import path from "path"
import { z } from "zod"
import { getConfig } from "../utils/get-config"
import { handleError } from "../utils/handle-error"
import { logger } from "../utils/logger"
import { performRemoteSync } from "../utils/remote-approval"
import { getCachedItemsPaths } from "../utils/remote-cache"

export const execOptionsSchema = z.object({
	promptName: z.string().min(1, "Prompt name is required"),
	agent: z.string().optional(),
	cwd: z.string(),
	remote: z.boolean(),
	remoteOnly: z.boolean(),
	yes: z.boolean(),
})

export const exec = new Command()
	.name("exec")
	.description("execute a prompt with an agent after approval")
	.argument("<prompt>", "name of the prompt to execute")
	.argument("[agent]", "name of the agent to use (defaults to first available)")
	.option(
		"-c, --cwd <cwd>",
		"the working directory. defaults to the current directory.",
		process.cwd(),
	)
	.option(
		"-r, --remote",
		"use agents/prompts from the remote registry (downloads if missing)",
		false,
	)
	.option(
		"--remote-only",
		"use only remote agents/prompts (ignore local agents.json)",
		false,
	)
	.option("-y, --yes", "skip confirmation prompt for remote sync", false)
	.action(async (promptName: string, agent: string | undefined, opts) => {
		try {
			const options = execOptionsSchema.parse({
				promptName,
				agent,
				cwd: path.resolve(opts.cwd),
				remote: opts.remote ?? false,
				remoteOnly: opts.remoteOnly ?? false,
				yes: opts.yes ?? false,
			})
			const config = await getConfig(options.cwd)
			const remotePaths = getCachedItemsPaths()

			if ((options.remote || options.remoteOnly) && !options.agent) {
				logger.error(
					"An agent name is required when using --remote or --remote-only.",
				)
				logger.info("Usage: awesome-ai exec <prompt> <agent> --remote")
				process.exit(1)
			}

			if (options.remote || options.remoteOnly) {
				const result = await performRemoteSync(
					[
						{ name: options.promptName, type: "prompts" },
						{ name: options.agent!, type: "agents" },
					],
					{ yes: options.yes },
				)
				if (result.cancelled) {
					logger.info("Remote sync cancelled.")
					process.exit(0)
				}
				if (!result.success) {
					process.exit(1)
				}

				if (options.remoteOnly || (!config && options.remote)) {
					await runTui({
						agentPaths: [remotePaths.agents],
						promptsPaths: [remotePaths.prompts],
						promptName: options.promptName,
						initialAgent: options.agent,
						cwd: options.cwd,
					})
					return
				}
			}

			if (!config) {
				logger.error(
					`agents.json not found in ${options.cwd}. Run 'awesome-ai init' to create one, or use --remote to run with remote agents.`,
				)
				process.exit(1)
			}

			const agentsPath = config.resolvedPaths.agents
			const promptsPath = config.resolvedPaths.prompts

			if (!agentsPath) {
				logger.error("Could not resolve agents path from agents.json")
				process.exit(1)
			}

			if (!promptsPath) {
				logger.error("Could not resolve prompts path from agents.json")
				process.exit(1)
			}

			// Build paths arrays - local paths first, then remote if enabled
			const agentPaths = options.remote
				? [agentsPath, remotePaths.agents]
				: [agentsPath]
			const promptsPaths = options.remote
				? [promptsPath, remotePaths.prompts]
				: [promptsPath]

			await runTui({
				agentPaths,
				promptsPaths,
				promptName: options.promptName,
				initialAgent: options.agent,
				cwd: options.cwd,
			})
		} catch (error) {
			logger.break()
			handleError(error)
		}
	})
