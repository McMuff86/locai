"use client";

import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message, MessageContent, MessageImageContent, Conversation } from '../types/chat';
import { sendChatMessage, sendStreamingChatMessage, ChatResponse } from '../lib/ollama';

export interface TokenStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalDuration: number;
  tokensPerSecond: number;
}

export interface UseChatReturn {
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  tokenStats: TokenStats | null;
  sendMessage: (
    content: string,
    images: File[] | undefined,
    conversation: Conversation,
    model: string,
    onUserMessage: (msg: Message) => void,
    onBotMessage: (msg: Message) => void,
    onModelSwitch?: (newModel: string) => void,
    visionModels?: string[],
    useStreaming?: boolean
  ) => Promise<void>;
  clearTokenStats: () => void;
  stopStreaming: () => void;
}

export function useChat(): UseChatReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const processImages = async (files: File[]): Promise<MessageImageContent[]> => {
    return Promise.all(
      files.map(async (file) => {
        return new Promise<MessageImageContent>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              resolve({
                type: 'image',
                url: e.target.result as string,
                alt: file.name
              });
            }
          };
          reader.readAsDataURL(file);
        });
      })
    );
  };

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  const sendMessage = useCallback(async (
    content: string,
    images: File[] | undefined,
    conversation: Conversation,
    model: string,
    onUserMessage: (msg: Message) => void,
    onBotMessage: (msg: Message) => void,
    onModelSwitch?: (newModel: string) => void,
    visionModels?: string[],
    useStreaming: boolean = true // Default to streaming
  ) => {
    if (!model || (!content.trim() && (!images || images.length === 0))) return;

    let currentModel = model;

    // Check if we need to switch to a vision model for images
    if (images && images.length > 0) {
      const isVisionModel = currentModel.toLowerCase().includes('vision');
      
      if (!isVisionModel && visionModels && visionModels.length > 0) {
        currentModel = visionModels[0];
        onModelSwitch?.(currentModel);
      }
    }

    // Process images if any
    let messageContent: MessageContent = content;
    
    if (images && images.length > 0) {
      const imageContents = await processImages(images);
      
      if (content.trim()) {
        messageContent = [content, ...imageContents] as MessageContent;
      } else {
        messageContent = imageContents as unknown as MessageContent;
      }
    }

    // Create and emit user message
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      modelName: currentModel
    };
    onUserMessage(userMessage);

    setIsLoading(true);
    setStreamingContent('');

    // Prepare messages for API
    const apiMessages = conversation.messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content
    }));
    
    apiMessages.push({
      role: 'user',
      content: messageContent
    });

    const botMessageId = uuidv4();

    if (useStreaming) {
      // Streaming mode
      setIsStreaming(true);
      
      // Create initial empty bot message for streaming
      const initialBotMessage: Message = {
        id: botMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        modelName: currentModel
      };
      onBotMessage(initialBotMessage);

      await sendStreamingChatMessage(
        currentModel,
        apiMessages,
        // onChunk - update streaming content
        (_chunk, fullContent) => {
          setStreamingContent(fullContent);
          // Update the bot message with new content
          const updatedMessage: Message = {
            id: botMessageId,
            role: 'assistant',
            content: fullContent,
            timestamp: new Date(),
            modelName: currentModel
          };
          onBotMessage(updatedMessage);
        },
        // onComplete
        (response) => {
          setIsStreaming(false);
          setIsLoading(false);
          setStreamingContent('');
          
          if (response.tokenStats) {
            setTokenStats(response.tokenStats);
          }
          
          // Final update with complete content
          const finalMessage: Message = {
            id: botMessageId,
            role: 'assistant',
            content: response.content,
            timestamp: new Date(),
            modelName: currentModel
          };
          onBotMessage(finalMessage);
        },
        // onError
        (error) => {
          console.error('Streaming error:', error);
          setIsStreaming(false);
          setIsLoading(false);
          
          const errorMessage: Message = {
            id: botMessageId,
            role: 'assistant',
            content: 'An error occurred. Please try again later.',
            timestamp: new Date(),
            modelName: currentModel
          };
          onBotMessage(errorMessage);
        }
      );
    } else {
      // Non-streaming mode (fallback)
      try {
        const response = await sendChatMessage(currentModel, apiMessages);

        if (response.tokenStats) {
          setTokenStats(response.tokenStats);
        }

        const botResponse: Message = {
          id: botMessageId,
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
          modelName: currentModel
        };

        onBotMessage(botResponse);
      } catch (error) {
        console.error('Error sending message:', error);
        
        const errorMessage: Message = {
          id: botMessageId,
          role: 'assistant',
          content: 'An error occurred. Please try again later.',
          timestamp: new Date(),
          modelName: currentModel
        };
        
        onBotMessage(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  const clearTokenStats = useCallback(() => {
    setTokenStats(null);
  }, []);

  return {
    isLoading,
    isStreaming,
    streamingContent,
    tokenStats,
    sendMessage,
    clearTokenStats,
    stopStreaming
  };
}

export default useChat;

