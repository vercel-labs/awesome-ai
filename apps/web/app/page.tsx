import { Header } from "@/components/header";
import { AgentsList } from "@/components/agents-list";
import { Terminal } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="flex items-center gap-2 text-primary text-sm mb-4">
            <Terminal className="h-4 w-4" />
            <span>awesome-ai marketplace</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
            AI Agents for Every Task
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            Discover and deploy pre-configured AI agents. Install with a single
            command or deploy directly to Vercel.
          </p>
          
          {/* Quick Install Example */}
          <div className="mt-8 p-4 rounded border border-border bg-card">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <span className="w-3 h-3 rounded-full bg-destructive/80" />
              <span className="w-3 h-3 rounded-full bg-chart-4/80" />
              <span className="w-3 h-3 rounded-full bg-primary/80" />
              <span className="ml-2">terminal</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground select-none">$</span>
                <span className="text-foreground">npx awesome-ai init</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground select-none">$</span>
                <span className="text-foreground">awesome-ai add code-reviewer</span>
              </div>
              <div className="text-primary">
                {">"} Agent installed successfully!
              </div>
            </div>
          </div>
        </div>

        {/* Available Agents Section */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <span className="text-primary">{">"}</span>
            <h2 className="text-xl font-semibold text-foreground">
              Available Agents
            </h2>
          </div>
          <AgentsList />
        </section>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border py-8 mt-16">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <span>awesome-ai</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com" className="hover:text-foreground transition-colors">
              GitHub
            </a>
            <a href="https://vercel.com" className="hover:text-foreground transition-colors">
              Vercel
            </a>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
