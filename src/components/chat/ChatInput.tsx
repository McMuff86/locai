import React, { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ChatInputProps } from "../../types/chat";
import { motion } from "framer-motion";
import { Send } from "lucide-react";

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message);
      setMessage("");
    }
  };

  return (
    <motion.div
      className="sticky bottom-0 w-full p-4 bg-background border-t"
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter message..."
          disabled={disabled}
          className="flex-grow"
        />
        <Button type="submit" disabled={disabled || !message.trim()}>
          <Send className="h-4 w-4 mr-2" />
          Send
        </Button>
      </form>
    </motion.div>
  );
} 