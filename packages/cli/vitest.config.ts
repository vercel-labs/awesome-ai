import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		globals: true,
		exclude: ["**/node_modules/**", "**/dist/**"],
		testTimeout: 30000, // CLI commands may take time
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
})
