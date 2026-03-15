import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		globals: true,
		exclude: ["**/node_modules/**", "**/dist/**"],
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@/tools": path.resolve(__dirname, "./src/tools"),
		},
	},
})
