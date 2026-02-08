"use client"

import { Search } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { Agent } from "@/lib/agents"
import { AgentCard } from "./agent-card"

interface AgentsListProps {
	agents: Agent[]
	categories: string[]
}

export function AgentsList({ agents, categories }: AgentsListProps) {
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
		<div className="space-y-6">
			{/* Search and Filter Bar */}
			<div className="flex flex-col sm:flex-row gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						type="text"
						placeholder="Search agents..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-10 bg-secondary"
					/>
				</div>
				<Select
					value={selectedCategory || "all"}
					onValueChange={(value) =>
						setSelectedCategory(value === "all" ? null : value)
					}
				>
					<SelectTrigger className="w-full sm:w-[180px] bg-secondary">
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
			</div>

			{/* Results Count */}
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<span className="text-primary">{">"}</span>
				<span>
					Found {filteredAgents.length} agent
					{filteredAgents.length !== 1 ? "s" : ""}
				</span>
				{selectedCategory && (
					<span>
						in <span className="text-accent">{selectedCategory}</span>
					</span>
				)}
			</div>

			{/* Agents Grid */}
			<div className="grid gap-4">
				{filteredAgents.map((agent) => (
					<AgentCard key={agent.name} agent={agent} />
				))}
				{filteredAgents.length === 0 && (
					<div className="text-center py-12 text-muted-foreground">
						<p>No agents found matching your criteria.</p>
						<Button
							variant="link"
							onClick={() => {
								setSearchQuery("")
								setSelectedCategory(null)
							}}
							className="mt-2"
						>
							Clear filters
						</Button>
					</div>
				)}
			</div>
		</div>
	)
}
