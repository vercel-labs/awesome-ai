declare module 'awesome-ai-tui' {
	export function runTui(options: any): Promise<void>
	export function discoverAgents(cwd: string | string[]): Promise<any[]>
}
