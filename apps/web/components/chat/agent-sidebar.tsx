"use client"

import { Check, Search, Terminal } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { Agent } from "@/lib/agents"
import { cn } from "@/lib/utils"

interface AgentSidebarProps {
	agents: Agent[]
	categories: string[]
	selectedAgent: Agent | null
	onSelectAgent: (agent: Agent) => void
}

export function AgentSidebar({
	agents,
	categories,
	selectedAgent,
	onSelectAgent,
}: AgentSidebarProps) {
	const [searchQuery, setSearchQuery] = useState("")
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

	const filteredAgents = agents.filter((agent) => {
		const matchesSearch =
			agent.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			agent.description.toLowerCase().includes(searchQuery.toLowerCase())
		const matchesCategory =
			!selectedCategory || agent.categories.includes(selectedCategory)
		return matchesSearch && matchesCategory
	})

	return (
		<div className="w-72 border-r border-border bg-card flex flex-col h-full">
			<div className="p-4 border-b border-border space-y-3">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Terminal className="h-4 w-4 text-primary" />
					<span className="text-foreground font-medium">Select Agent</span>
				</div>
				<div className="relative">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
					<Input
						type="text"
						placeholder="Search agents..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-8 h-8 text-sm bg-secondary"
					/>
				</div>
				<Select
					value={selectedCategory || "all"}
					onValueChange={(value) =>
						setSelectedCategory(value === "all" ? null : value)
					}
				>
					<SelectTrigger className="h-8 text-sm bg-secondary">
						<SelectValue placeholder="All Categories" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Categories</SelectItem>
						{categories.map((category) => (
							<SelectItem key={category} value={category}>
								{category}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="text-xs text-muted-foreground">
					<span className="text-primary">{">"}</span> {filteredAgents.length}{" "}
					agent{filteredAgents.length !== 1 ? "s" : ""}
					{selectedCategory && <span> in {selectedCategory}</span>}
				</div>
			</div>
			<ScrollArea className="flex-1">
				<div className="p-2">
					{filteredAgents.map((agent) => (
						<Button
							key={agent.name}
							variant="ghost"
							className={cn(
								"w-full justify-start text-left h-auto py-3 px-3 mb-1",
								selectedAgent?.name === agent.name && "bg-secondary",
							)}
							onClick={() => onSelectAgent(agent)}
						>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium truncate">
										{agent.title}
									</span>
									{selectedAgent?.name === agent.name && (
										<Check className="h-3 w-3 text-primary shrink-0" />
									)}
								</div>
								<div className="flex items-center gap-2 mt-1">
									{agent.categories.slice(0, 2).map((cat) => (
										<Badge key={cat} variant="secondary" className="text-xs">
											{cat}
										</Badge>
									))}
								</div>
							</div>
						</Button>
					))}
					{filteredAgents.length === 0 && (
						<div className="text-center py-6 text-sm text-muted-foreground">
							<p>No agents found.</p>
							<Button
								variant="link"
								size="sm"
								onClick={() => {
									setSearchQuery("")
									setSelectedCategory(null)
								}}
								className="mt-1"
							>
								Clear filters
							</Button>
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	)
}
