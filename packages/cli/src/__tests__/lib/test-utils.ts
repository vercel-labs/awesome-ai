import { type ExecaError, execa } from "execa"
import { promises as fs } from "fs"
import { tmpdir } from "os"
import path from "path"

// Use TypeScript source directly with bun
const CLI_PATH = path.resolve(__dirname, "../../index.ts")

interface TestProject {
	path: string
	readFile: (filePath: string) => Promise<string>
	exists: (filePath: string) => Promise<boolean>
	writeFile: (filePath: string, content: string) => Promise<void>
	cleanup: () => Promise<void>
}

interface CreateTestProjectOptions {
	packageJson?: Record<string, unknown>
	tsconfig?: boolean | Record<string, unknown>
	files?: Record<string, string>
}

interface CLIResult {
	stdout: string
	stderr: string
	exitCode: number
}

/**
 * Create an isolated test project in a temporary directory
 */
export async function createTestProject(
	options: CreateTestProjectOptions = {},
): Promise<TestProject> {
	const projectPath = await fs.mkdtemp(path.join(tmpdir(), "cli-test-"))

	const project: TestProject = {
		path: projectPath,

		async readFile(filePath: string): Promise<string> {
			return fs.readFile(path.join(projectPath, filePath), "utf-8")
		},

		async exists(filePath: string): Promise<boolean> {
			try {
				await fs.access(path.join(projectPath, filePath))
				return true
			} catch {
				return false
			}
		},

		async writeFile(filePath: string, content: string): Promise<void> {
			const fullPath = path.join(projectPath, filePath)
			await fs.mkdir(path.dirname(fullPath), { recursive: true })
			await fs.writeFile(fullPath, content, "utf-8")
		},

		async cleanup(): Promise<void> {
			try {
				await fs.rm(projectPath, { recursive: true, force: true })
			} catch {
				// Ignore cleanup errors
			}
		},
	}

	// Create package.json if specified
	if (options.packageJson) {
		await project.writeFile(
			"package.json",
			JSON.stringify(options.packageJson, null, 2),
		)
	}

	// Create tsconfig.json if specified
	if (options.tsconfig) {
		const tsconfigContent =
			options.tsconfig === true
				? {
						compilerOptions: {
							target: "ESNext",
							module: "ESNext",
							moduleResolution: "bundler",
							strict: true,
							esModuleInterop: true,
							skipLibCheck: true,
							baseUrl: ".",
							paths: {
								"@/*": ["./*"],
							},
						},
					}
				: options.tsconfig

		await project.writeFile(
			"tsconfig.json",
			JSON.stringify(tsconfigContent, null, 2),
		)
	}

	// Create any additional files
	if (options.files) {
		for (const [filePath, content] of Object.entries(options.files)) {
			await project.writeFile(filePath, content)
		}
	}

	return project
}

/**
 * Run the CLI with given arguments
 */
export async function runCLI(
	args: string[],
	options: {
		cwd?: string
		env?: Record<string, string>
		timeout?: number
	} = {},
): Promise<CLIResult> {
	try {
		const result = await execa("bun", [CLI_PATH, ...args], {
			cwd: options.cwd,
			timeout: options.timeout ?? 10000, // 10 second timeout by default
			env: {
				...process.env,
				...options.env,
				// Disable colors for easier testing
				NO_COLOR: "1",
				FORCE_COLOR: "0",
				// Run in CI mode to skip interactive prompts
				CI: "true",
			},
			reject: false,
		})

		return {
			stdout: result.stdout,
			stderr: result.stderr,
			exitCode: result.exitCode ?? 0,
		}
	} catch (error) {
		const execaError = error as ExecaError
		return {
			stdout: String(execaError.stdout ?? ""),
			stderr: String(execaError.stderr ?? ""),
			exitCode: execaError.exitCode ?? 1,
		}
	}
}
