import { discoverAgents, runTui } from "awesome-ai-tui"
import { Command } from "commander"
import path from "path"
import { z } from "zod"
import { getConfig } from "../utils/get-config"
import { handleError } from "../utils/handle-error"
import { logger } from "../utils/logger"
import { performRemoteSync } from "../utils/remote-approval"
import { getCachedItemsPaths } from "../utils/remote-cache"

export const runOptionsSchema = z.object({
	agent: z.string().optional(),
	cwd: z.string(),
	remote: z.boolean(),
	remoteOnly: z.boolean(),
	yes: z.boolean(),
})

export const run = new Command()
	.name("run")
	.description("start an interactive TUI chat with an agent")
	.argument("[agent]", "name of the agent to run")
	.option(
		"-c, --cwd <cwd>",
		"the working directory. defaults to the current directory.",
		process.cwd(),
	)
	.option(
		"-r, --remote",
		"use agents from the remote registry (downloads if missing)",
		false,
	)
	.option(
		"--remote-only",
		"use only remote agents (ignore local agents.json)",
		false,
	)
	.option("-y, --yes", "skip confirmation prompt for remote sync", false)
	.action(async (agent, opts) => {
		try {
			const options = runOptionsSchema.parse({
				agent,
				cwd: path.resolve(opts.cwd),
				remote: opts.remote ?? false,
				remoteOnly: opts.remoteOnly ?? false,
				yes: opts.yes ?? false,
			})
			const config = await getConfig(options.cwd)
			const remotePaths = getCachedItemsPaths()

			// Require agent name when using remote options
			if ((options.remote || options.remoteOnly) && !options.agent) {
				logger.error(
					"An agent name is required when using --remote or --remote-only.",
				)
				logger.info("Usage: awesome-ai run <agent> --remote")
				process.exit(1)
			}

			if (!options.agent) {
				if (!config) {
					logger.error(
						`agents.json not found in ${options.cwd}. Run 'awesome-ai init' to create one.`,
					)
					process.exit(1)
				}

				const localAgents = await discoverAgents(config.resolvedPaths.agents)
				if (localAgents.length === 0) {
					logger.error("No agents found. Add agents with 'awesome-ai add'.")
					process.exit(1)
				}

				logger.info("Available agents:")
				for (const agent of localAgents) {
					logger.info(`  - ${agent.name}`)
				}
				logger.break()
				logger.info("Run with: awesome-ai run <agent>")
				process.exit(0)
			}

			if (options.remote || options.remoteOnly) {
				const result = await performRemoteSync(
					[{ name: options.agent, type: "agents" }],
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

			if (!agentsPath) {
				logger.error("Could not resolve agents path from agents.json")
				process.exit(1)
			}

			// Build paths array - local path first, then remote if enabled
			const agentPaths = options.remote
				? [agentsPath, remotePaths.agents]
				: [agentsPath]

			await runTui({
				agentPaths,
				initialAgent: options.agent,
				cwd: options.cwd,
			})
		} catch (error) {
			logger.break()
			handleError(error)
		}
	})
