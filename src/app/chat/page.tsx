"use client";

import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChatContainer } from "../../components/chat/ChatContainer";
import { ChatInput } from "../../components/chat/ChatInput";
import { Conversation, Message } from "../../types/chat";
import { getOllamaModels, sendChatMessage, OllamaModel } from "../../lib/ollama";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ThemeToggle } from "../../components/ui/theme-toggle";

export default function ChatPage() {
  // Model state
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);

  // Chat state
  const [conversation, setConversation] = useState<Conversation>({
    id: uuidv4(),
    title: "New Conversation",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const [isLoading, setIsLoading] = useState(false);

  // Fetch models when the page loads
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setIsModelLoading(true);
        const ollamaModels = await getOllamaModels();
        setModels(ollamaModels);
        
        // If models are available, select the first one
        if (ollamaModels.length > 0) {
          setSelectedModel(ollamaModels[0].name);
        }
        
        setModelError(null);
      } catch (error) {
        console.error("Error loading models:", error);
        setModelError("Connection to Ollama could not be established. Please check if Ollama is running.");
      } finally {
        setIsModelLoading(false);
      }
    };

    fetchModels();
  }, []);

  // Starting a new conversation with a model
  const startConversation = () => {
    if (!selectedModel) return;

    // Add system message
    const systemMessage: Message = {
      id: uuidv4(),
      role: "system",
      content: `You are LocAI, an AI assistant based on the ${selectedModel} model, running locally through Ollama.`,
      timestamp: new Date()
    };

    setConversation({
      id: uuidv4(),
      title: `Chat with ${selectedModel}`,
      messages: [systemMessage],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  };

  // Send chat message
  const handleSendMessage = async (content: string) => {
    if (!selectedModel || !content.trim()) return;

    // Create user message
    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content,
      timestamp: new Date()
    };

    // Update conversation
    setConversation(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      updatedAt: new Date()
    }));

    // Set loading state
    setIsLoading(true);

    try {
      // Prepare messages for the Ollama API
      const apiMessages = conversation.messages.map(message => ({
        role: message.role as 'system' | 'user' | 'assistant',
        content: message.content
      }));
      
      // Add the new user message
      apiMessages.push({
        role: 'user',
        content
      });

      // Send chat request to Ollama
      const responseContent = await sendChatMessage(selectedModel, apiMessages);

      // Create bot response
      const botResponse: Message = {
        id: uuidv4(),
        role: "assistant",
        content: responseContent,
        timestamp: new Date()
      };

      // Update conversation with bot response
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, botResponse],
        updatedAt: new Date()
      }));
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Show error message as bot response
      const errorMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: "An error occurred. Please try again later.",
        timestamp: new Date()
      };
      
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        updatedAt: new Date()
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">LocAI - running on bare metal</h1>
        <ThemeToggle />
      </header>
      
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Model selection if no conversation started */}
        {conversation.messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Select Model</CardTitle>
              </CardHeader>
              <CardContent>
                {isModelLoading ? (
                  <div className="text-center p-4">
                    <div className="animate-pulse flex space-x-2 justify-center mb-4">
                      <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
                      <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
                      <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
                    </div>
                    <p>Loading available models...</p>
                  </div>
                ) : modelError ? (
                  <div className="text-center text-red-500 p-4">
                    {modelError}
                  </div>
                ) : models.length === 0 ? (
                  <div className="text-center p-4">
                    <p>No models found. Please ensure you have models installed in Ollama.</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-col gap-2 mb-4">
                      {models.map((model) => (
                        <Button
                          key={model.name}
                          variant={selectedModel === model.name ? "default" : "outline"}
                          className="justify-start"
                          onClick={() => setSelectedModel(model.name)}
                        >
                          {model.name}
                        </Button>
                      ))}
                    </div>
                    
                    <Button 
                      className="w-full" 
                      onClick={startConversation}
                      disabled={!selectedModel}
                    >
                      Start Conversation
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <ChatContainer conversation={conversation} isLoading={isLoading} />
            <ChatInput onSend={handleSendMessage} disabled={isLoading} />
          </>
        )}
      </main>
    </div>
  );
} 