import { type Change, diffLines } from "diff"
import { existsSync, promises as fs, statSync } from "fs"
import path, { basename } from "path"
import prompts from "prompts"
import type { RegistryItem, RegistryItemCategory } from "@/src/registry/schema"
import type { Config } from "@/src/schema"
import { isContentSame } from "@/src/utils/compare"
import { getRelativePath, getTargetDir } from "@/src/utils/file-type"
import { getProjectInfo } from "@/src/utils/get-project-info"
import { highlighter } from "@/src/utils/highlighter"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import { transformImports } from "@/src/utils/transform-import"

export async function updateFiles(
	files: RegistryItem["files"],
	type: RegistryItemCategory,
	config: Config,
	options: {
		overwrite?: boolean
		silent?: boolean
		path?: string
		yes?: boolean
	},
) {
	if (!files?.length) {
		return {
			filesCreated: [],
			filesUpdated: [],
			filesSkipped: [],
		}
	}

	options = {
		overwrite: false,
		silent: false,
		yes: false,
		...options,
	}

	const filesCreatedSpinner = spinner(`Updating files.`, {
		silent: options.silent,
	})?.start()

	const projectInfo = await getProjectInfo(config.resolvedPaths.cwd)

	const filesCreated: string[] = []
	const filesUpdated: string[] = []
	const filesSkipped: string[] = []

	for (const file of files) {
		const fileType = getTargetDir(file, type)
		const relativePath = getRelativePath(file.path)
		const basePath = options.path || config.resolvedPaths[fileType]

		let filePath = path.resolve(basePath, relativePath)

		if (projectInfo?.isSrcDir && !filePath.includes("src")) {
			const srcPath = path.resolve(config.resolvedPaths.cwd, "src")
			filePath = path.resolve(srcPath, relativePath)
		}

		const fileName = basename(file.path)
		const targetDir = path.dirname(filePath)

		if (!config.tsx && projectInfo?.isTsx) {
			filePath = filePath.replace(/\.tsx?$/, (match) =>
				match === ".tsx" ? ".jsx" : ".js",
			)
		}

		const existingFile = existsSync(filePath)

		if (existingFile && statSync(filePath).isDirectory()) {
			throw new Error(
				`Cannot write to ${filePath}: path exists and is a directory. Please provide a file path instead.`,
			)
		}

		const content = await transformImports({
			filename: file.path,
			raw: file.content,
			config,
			isRemote: false,
		})

		if (existingFile && !options.overwrite) {
			const existingFileContent = await fs.readFile(filePath, "utf-8")

			if (isContentSame(existingFileContent, content)) {
				filesSkipped.push(path.relative(config.resolvedPaths.cwd, filePath))
				continue
			}

			if (!options.yes) {
				filesCreatedSpinner.stop()

				const diff = diffLines(existingFileContent, content)
				logger.info(`\nFile: ${highlighter.info(fileName)}`)
				printDiff(diff)

				const { overwrite } = await prompts({
					type: "confirm",
					name: "overwrite",
					message: `The file ${highlighter.info(
						fileName,
					)} already exists. Would you like to overwrite?`,
					initial: false,
				})

				if (!overwrite) {
					filesSkipped.push(path.relative(config.resolvedPaths.cwd, filePath))
					filesCreatedSpinner?.start()
					continue
				}
				filesCreatedSpinner?.start()
			}
		}

		if (!existsSync(targetDir)) {
			await fs.mkdir(targetDir, { recursive: true })
		}

		await fs.writeFile(filePath, content, "utf-8")

		if (!existingFile) {
			filesCreated.push(path.relative(config.resolvedPaths.cwd, filePath))
		} else {
			filesUpdated.push(path.relative(config.resolvedPaths.cwd, filePath))
		}
	}

	const hasUpdatedFiles = filesCreated.length || filesUpdated.length
	if (!hasUpdatedFiles && !filesSkipped.length) {
		filesCreatedSpinner?.info("No files updated.")
	} else {
		filesCreatedSpinner?.succeed()
	}

	return {
		filesCreated,
		filesUpdated,
		filesSkipped,
	}
}

function printDiff(diff: Change[]) {
	for (const part of diff) {
		if (part) {
			if (part.added) {
				process.stdout.write(highlighter.success(part.value))
			} else if (part.removed) {
				process.stdout.write(highlighter.error(part.value))
			} else {
				process.stdout.write(part.value)
			}
		}
	}
}
