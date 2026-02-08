"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Terminal, ArrowLeft } from "lucide-react";
import { agents, type Agent } from "@/lib/agents";
import { mockChats, type Chat, type Message } from "@/lib/chat";
import { AgentSidebar } from "@/components/chat/agent-sidebar";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatArea } from "@/components/chat/chat-area";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>(mockChats);
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSelectAgent = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    // Filter chats for this agent
    const agentChats = chats.filter((c) => c.agentId === agent.id);
    // If there's a current chat for this agent, keep it selected
    if (selectedChat && selectedChat.agentId === agent.id) {
      return;
    }
    // Otherwise start fresh
    setSelectedChat(null);
    setMessages([]);
  }, [chats, selectedChat]);

  const handleSelectChat = useCallback((chat: Chat) => {
    setSelectedChat(chat);
    setMessages(chat.messages);
    // Also select the agent for this chat
    const agent = agents.find((a) => a.id === chat.agentId);
    if (agent) {
      setSelectedAgent(agent);
    }
  }, []);

  const handleNewChat = useCallback(() => {
    setSelectedChat(null);
    setMessages([]);
  }, []);

  const handleDeleteChat = useCallback((chatId: string) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (selectedChat?.id === chatId) {
      setSelectedChat(null);
      setMessages([]);
    }
  }, [selectedChat]);

  const handleSendMessage = useCallback((content: string) => {
    if (!selectedAgent) return;

    const userMessage: Message = {
      id: `m-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `m-${Date.now() + 1}`,
        role: "assistant",
        content: `[${selectedAgent.name}] I received your message: "${content}"\n\nThis is a demo response. In a real implementation, this would connect to an AI backend.`,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, assistantMessage]);

      // Create or update chat
      if (!selectedChat) {
        const newChat: Chat = {
          id: `chat-${Date.now()}`,
          title: content.slice(0, 30) + (content.length > 30 ? "..." : ""),
          agentId: selectedAgent.id,
          messages: [...newMessages, assistantMessage],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setChats((prev) => [newChat, ...prev]);
        setSelectedChat(newChat);
      } else {
        setChats((prev) =>
          prev.map((c) =>
            c.id === selectedChat.id
              ? {
                  ...c,
                  messages: [...newMessages, assistantMessage],
                  updatedAt: new Date(),
                }
              : c
          )
        );
      }
    }, 500);
  }, [selectedAgent, messages, selectedChat]);

  // Filter chats based on selected agent
  const filteredChats = selectedAgent
    ? chats.filter((c) => c.agentId === selectedAgent.id)
    : chats;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-primary/10 border border-primary/30">
                <Terminal className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-foreground">awesome-ai chat</span>
            </div>
          </div>
          <code className="text-xs text-muted-foreground hidden sm:block">
            $ awesome-ai chat --interactive
          </code>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <AgentSidebar
          selectedAgent={selectedAgent}
          onSelectAgent={handleSelectAgent}
        />
        <ChatArea
          agent={selectedAgent}
          messages={messages}
          onSendMessage={handleSendMessage}
        />
        <ChatSidebar
          chats={filteredChats}
          selectedChat={selectedChat}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
        />
      </div>
    </div>
  );
}
