import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		globals: true,
		exclude: ["**/node_modules/**", "**/dist/**"],
	},
	resolve: {
		alias: {
			"@/tools": path.resolve(__dirname, "./src/tools"),
			"@/prompts": path.resolve(__dirname, "./src/prompts"),
			"@/agents": path.resolve(__dirname, "./src/agents"),
		},
	},
})
