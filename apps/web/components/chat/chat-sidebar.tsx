"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import type { Chat } from "@/lib/chat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  chats: Chat[];
  selectedChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
}

export function ChatSidebar({
  chats,
  selectedChat,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: ChatSidebarProps) {
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="w-64 border-l border-border bg-card flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-foreground font-medium">History</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onNewChat}
          title="New chat"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {chats.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <p>No chats yet</p>
              <p className="text-xs mt-1">Start a conversation</p>
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  "group relative rounded mb-1",
                  selectedChat?.id === chat.id && "bg-secondary"
                )}
              >
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left h-auto py-3 px-3 pr-8"
                  onClick={() => onSelectChat(chat)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {chat.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(chat.updatedAt)}
                    </div>
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(chat.id);
                  }}
                  title="Delete chat"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
