import { ArrowLeft, Info, Settings, Tag, Wrench } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CliCommand } from "@/components/cli-command"
import { DeployButton } from "@/components/deploy-button"
import { Header } from "@/components/header"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAgentBySlug, getAllAgents, getPromptContent } from "@/lib/agents"
import { getAllTools } from "@/lib/tools"

export async function generateStaticParams() {
	const agents = await getAllAgents()
	return agents.map((agent) => ({
		slug: agent.name,
	}))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params
	const agent = await getAgentBySlug(slug)
	if (!agent) return { title: "Agent Not Found" }
	return {
		title: `${agent.title} - awesome-ai`,
		description: agent.description,
	}
}

export default async function AgentPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params
	const agent = await getAgentBySlug(slug)

	if (!agent) {
		notFound()
	}

	const [promptContent, allTools] = await Promise.all([
		agent.promptName ? getPromptContent(agent.promptName) : null,
		getAllTools(),
	])

	const toolSet = new Set(allTools.map((t) => t.name))

	return (
		<div className="min-h-screen bg-background">
			<Header />
			<main className="max-w-5xl mx-auto px-4 py-8">
				{/* Breadcrumb */}
				<Button variant="ghost" size="sm" asChild className="mb-8">
					<Link href="/">
						<ArrowLeft className="h-4 w-4" />
						Back to agents
					</Link>
				</Button>

				{/* Agent Header */}
				<div className="mb-8">
					<div className="flex items-center gap-3 mb-4">
						<h1 className="text-2xl md:text-3xl font-bold text-foreground">{agent.title}</h1>
					</div>
					<p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
						{agent.description}
					</p>
				</div>

				{/* Stats */}
				<div className="flex flex-wrap gap-4 mb-8 text-sm text-muted-foreground">
					{agent.categories.length > 0 && (
						<div className="flex items-center gap-2">
							<Tag className="h-4 w-4" />
							<div className="flex gap-1">
								{agent.categories.map((cat) => (
									<Badge key={cat} variant="secondary">
										{cat}
									</Badge>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Install Section */}
				<div className="grid md:grid-cols-2 gap-6 mb-12">
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium flex items-center gap-2">
								<span className="text-primary">{">"}</span>
								Install with CLI
							</CardTitle>
						</CardHeader>
						<CardContent>
							<CliCommand command={`awesome-ai add ${agent.name}`} />
							<p className="mt-4 text-xs text-muted-foreground">
								Run this command in your project directory to install this agent.
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium flex items-center gap-2">
								<span className="text-primary">{">"}</span>
								Deploy to Cloud
							</CardTitle>
						</CardHeader>
						<CardContent>
							<DeployButton agentSlug={agent.name} />
							<p className="mt-4 text-xs text-muted-foreground">
								Deploy this agent to Vercel with one click.
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Tools Section */}
				{agent.tools.length > 0 && (
					<div className="mb-12">
						<h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
							<Wrench className="h-5 w-5 text-primary" />
							Tools
						</h2>
						<div className="flex flex-wrap gap-2">
							{agent.tools.map((tool) =>
								toolSet.has(tool) ? (
									<Link key={tool} href={`/tools/${tool}`}>
										<Badge
											variant="outline"
											className="hover:border-primary/50 hover:text-primary transition-colors cursor-pointer"
										>
											{tool}
										</Badge>
									</Link>
								) : (
									<Badge key={tool} variant="outline">
										{tool}
									</Badge>
								),
							)}
						</div>
					</div>
				)}

				{/* Config Section */}
				{agent.config.length > 0 && (
					<div className="mb-12">
						<h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
							<Settings className="h-5 w-5 text-primary" />
							Configuration
						</h2>
						<div className="space-y-3">
							{agent.config.map((cfg) => (
								<Card key={`${cfg.name}-${cfg.env ?? cfg.type}`}>
									<CardContent className="pt-4 pb-4">
										<div className="flex items-start justify-between gap-4">
											<div>
												<code className="text-sm font-medium text-foreground">{cfg.name}</code>
												<span className="text-xs text-muted-foreground ml-2">
													{cfg.type}
													{!cfg.required && " (optional)"}
												</span>
												<p className="text-sm text-muted-foreground mt-1">{cfg.description}</p>
											</div>
											{cfg.env && (
												<Badge variant="outline" className="shrink-0">
													{cfg.env}
												</Badge>
											)}
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				)}

				{/* System Prompt Section */}
				{promptContent && (
					<div className="mb-12">
						<h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
							<span className="text-primary">{"$"}</span>
							System Prompt
						</h2>
						{agent.context.includes("coding") && (
							<div className="flex items-start gap-3 p-3 rounded border border-border bg-secondary/50 mb-4 text-sm text-muted-foreground">
								<Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
								<p>
									This agent requires a working directory. At runtime, environment context
									(platform, file tree, and custom rules) is appended to the prompt automatically.
								</p>
							</div>
						)}
						<Card className="overflow-x-auto">
							<CardContent className="pt-6">
								<MarkdownRenderer content={promptContent} />
							</CardContent>
						</Card>
					</div>
				)}
			</main>

			{/* Footer */}
			<footer className="border-t border-border py-8 mt-16">
				<div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground">
					<p>
						Built with <span className="text-primary">awesome-ai</span>
					</p>
				</div>
			</footer>
		</div>
	)
}
