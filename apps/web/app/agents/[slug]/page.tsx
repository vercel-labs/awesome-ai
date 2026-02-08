import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Tag,
  User,
  Wrench,
} from "lucide-react";
import { agents, getAgentBySlug } from "@/lib/agents";
import { Header } from "@/components/header";
import { CliCommand } from "@/components/cli-command";
import { DeployButton } from "@/components/deploy-button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function generateStaticParams() {
  return agents.map((agent) => ({
    slug: agent.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = getAgentBySlug(slug);
  if (!agent) return { title: "Agent Not Found" };
  return {
    title: `${agent.name} - awesome-ai`,
    description: agent.description,
  };
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = getAgentBySlug(slug);

  if (!agent) {
    notFound();
  }

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
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {agent.name}
            </h1>
            <Badge variant="secondary">v{agent.version}</Badge>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            {agent.description}
          </p>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-6 mb-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <span>{agent.downloads.toLocaleString()} downloads</span>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span>{agent.category}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>{agent.author}</span>
          </div>
          {agent.repository && (
            <a
              href={agent.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Repository</span>
            </a>
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
              <CliCommand command={`awesome-ai add ${agent.slug}`} />
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
              <DeployButton agentSlug={agent.slug} repository={agent.repository} />
              <p className="mt-4 text-xs text-muted-foreground">
                Deploy this agent to Vercel with one click.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tools Section */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Tools Used
          </h2>
          <div className="flex flex-wrap gap-2">
            {agent.tools.map((tool) => (
              <Badge key={tool} variant="outline">
                {tool}
              </Badge>
            ))}
          </div>
        </div>

        {/* System Prompt Section */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-primary">{"$"}</span>
            System Prompt
          </h2>
          <Card className="overflow-x-auto">
            <CardContent className="pt-6">
              <MarkdownRenderer content={agent.systemPrompt} />
            </CardContent>
          </Card>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-16">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            Built with{" "}
            <span className="text-primary">awesome-ai</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
