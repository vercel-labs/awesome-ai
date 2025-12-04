import { discoverAgents, runTui } from "awesome-ai-tui"
import { Command } from "commander"
import path from "path"
import { z } from "zod"
import { getConfig } from "@/src/utils/get-config"
import { handleError } from "@/src/utils/handle-error"
import { logger } from "@/src/utils/logger"
import { performRemoteSync } from "@/src/utils/remote-approval"
import { getCachedItemsPaths } from "@/src/utils/remote-cache"

const REQUIRED_AGENTS = ["migration-planning-agent", "migration-agent"] as const

export const migrateOptionsSchema = z.object({
	promptName: z.string().min(1, "Prompt name is required"),
	cwd: z.string(),
	remote: z.boolean(),
	remoteOnly: z.boolean(),
	yes: z.boolean(),
})

export const migrate = new Command()
	.name("migrate")
	.description("run a migration with planning and execution agents")
	.argument("<prompt>", "name of the migration prompt to execute")
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
	.action(async (promptName: string, opts) => {
		try {
			const options = migrateOptionsSchema.parse({
				promptName,
				cwd: path.resolve(opts.cwd),
				remote: opts.remote ?? false,
				remoteOnly: opts.remoteOnly ?? false,
				yes: opts.yes ?? false,
			})
			const config = await getConfig(options.cwd)
			const remotePaths = getCachedItemsPaths()

			if (options.remote || options.remoteOnly) {
				const result = await performRemoteSync(
					[
						{ name: options.promptName, type: "prompts" },
						...REQUIRED_AGENTS.map((name) => ({
							name,
							type: "agents" as const,
						})),
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
						initialAgent: "migration-planning-agent",
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

			const agentPaths = options.remote
				? [agentsPath, remotePaths.agents]
				: [agentsPath]
			const promptsPaths = options.remote
				? [promptsPath, remotePaths.prompts]
				: [promptsPath]

			const agents = await discoverAgents(agentPaths)
			const agentNames = agents.map((a) => a.name)

			const missingAgents = REQUIRED_AGENTS.filter(
				(agent) => !agentNames.includes(agent),
			)

			if (missingAgents.length > 0) {
				const suggestion = options.remote
					? `They may not be available in the remote registry.`
					: `Add them with 'awesome-ai add ${missingAgents.join(" ")}' or use --remote to fetch from registry`

				logger.error(
					`Missing required agents: ${missingAgents.join(", ")}. ${suggestion}`,
				)
				process.exit(1)
			}

			await runTui({
				agentPaths,
				promptsPaths,
				promptName: options.promptName,
				initialAgent: "migration-planning-agent",
				cwd: options.cwd,
			})
		} catch (error) {
			logger.break()
			handleError(error)
		}
	})
