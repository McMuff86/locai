"use client";

import { useState, useEffect, useCallback } from 'react';
import { getOllamaModels, OllamaModel, getModelSystemContent, getModelInfo } from '../lib/ollama';

export interface ModelContextInfo {
  contextLength: number;
  parameterSize: string;
}

export interface UseModelsReturn {
  models: OllamaModel[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  isLoading: boolean;
  error: string | null;
  hasVisionModel: boolean;
  visionModels: OllamaModel[];
  refreshModels: () => Promise<void>;
  getSystemPrompt: (modelName: string) => string;
  // New: Context info
  contextInfo: ModelContextInfo | null;
  isLoadingContextInfo: boolean;
}

export function useModels(): UseModelsReturn {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextInfo, setContextInfo] = useState<ModelContextInfo | null>(null);
  const [isLoadingContextInfo, setIsLoadingContextInfo] = useState(false);

  const fetchModels = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const ollamaModels = await getOllamaModels();
      setModels(ollamaModels);
      
      // Auto-select first model if none selected
      if (ollamaModels.length > 0 && !selectedModel) {
        setSelectedModel(ollamaModels[0].name);
      }
    } catch (err) {
      console.error('Error loading models:', err);
      setError('Connection to Ollama could not be established. Please check if Ollama is running.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedModel]);

  // Fetch context info when model changes
  useEffect(() => {
    if (!selectedModel) {
      setContextInfo(null);
      return;
    }
    
    const fetchContextInfo = async () => {
      setIsLoadingContextInfo(true);
      try {
        const info = await getModelInfo(selectedModel);
        setContextInfo(info);
      } catch (err) {
        console.error('Error fetching context info:', err);
        setContextInfo(null);
      } finally {
        setIsLoadingContextInfo(false);
      }
    };
    
    fetchContextInfo();
  }, [selectedModel]);

  useEffect(() => {
    fetchModels();
  }, []);

  // Filter vision models
  const visionModels = models.filter(m => 
    m.name.toLowerCase().includes('vision')
  );

  const hasVisionModel = visionModels.length > 0;

  const getSystemPrompt = useCallback((modelName: string) => {
    return getModelSystemContent(modelName);
  }, []);

  return {
    models,
    selectedModel,
    setSelectedModel,
    isLoading,
    error,
    hasVisionModel,
    visionModels,
    refreshModels: fetchModels,
    getSystemPrompt,
    contextInfo,
    isLoadingContextInfo
  };
}

export default useModels;

