import { ollamaFetch } from "@/lib/ollama-agent";
import { resolveAndValidateOllamaHost } from '../../_utils/ollama';
import { apiError, apiSuccess } from '../../_utils/responses';

export const dynamic = 'force-dynamic';

// Comprehensive model list organized by category
const POPULAR_MODELS = [
  // === GENERAL PURPOSE ===
  { name: 'llama3.2', size: '2.0 GB', description: 'Meta Llama 3.2 (3B) - Fast & capable', category: 'general' },
  { name: 'llama3.2:1b', size: '1.3 GB', description: 'Meta Llama 3.2 (1B) - Lightweight', category: 'general' },
  { name: 'llama3.1', size: '4.7 GB', description: 'Meta Llama 3.1 (8B) - Balanced', category: 'general' },
  { name: 'llama3.1:70b', size: '40 GB', description: 'Meta Llama 3.1 (70B) - Most capable', category: 'general' },
  { name: 'mistral', size: '4.1 GB', description: 'Mistral 7B - Excellent quality', category: 'general' },
  { name: 'mistral-nemo', size: '7.1 GB', description: 'Mistral Nemo (12B) - Latest', category: 'general' },
  { name: 'mixtral', size: '26 GB', description: 'Mixtral 8x7B MoE - Very capable', category: 'general' },
  { name: 'gemma2', size: '5.4 GB', description: 'Google Gemma 2 (9B)', category: 'general' },
  { name: 'gemma2:2b', size: '1.6 GB', description: 'Google Gemma 2 (2B) - Fast', category: 'general' },
  { name: 'gemma2:27b', size: '16 GB', description: 'Google Gemma 2 (27B) - Large', category: 'general' },
  { name: 'qwen2.5', size: '4.4 GB', description: 'Alibaba Qwen 2.5 (7B)', category: 'general' },
  { name: 'qwen2.5:0.5b', size: '397 MB', description: 'Alibaba Qwen 2.5 (0.5B) - Tiny', category: 'general' },
  { name: 'qwen2.5:14b', size: '9.0 GB', description: 'Alibaba Qwen 2.5 (14B)', category: 'general' },
  { name: 'qwen2.5:32b', size: '20 GB', description: 'Alibaba Qwen 2.5 (32B)', category: 'general' },
  { name: 'phi3', size: '2.2 GB', description: 'Microsoft Phi-3 Mini (3.8B)', category: 'general' },
  { name: 'phi3:medium', size: '7.9 GB', description: 'Microsoft Phi-3 Medium (14B)', category: 'general' },
  
  // === REASONING / THINKING ===
  { name: 'deepseek-r1', size: '4.7 GB', description: 'DeepSeek R1 (7B) - Reasoning', category: 'reasoning' },
  { name: 'deepseek-r1:8b', size: '4.9 GB', description: 'DeepSeek R1 (8B) - Reasoning', category: 'reasoning' },
  { name: 'deepseek-r1:14b', size: '9.0 GB', description: 'DeepSeek R1 (14B) - Better reasoning', category: 'reasoning' },
  { name: 'deepseek-r1:32b', size: '20 GB', description: 'DeepSeek R1 (32B) - Strong reasoning', category: 'reasoning' },
  { name: 'deepseek-r1:70b', size: '43 GB', description: 'DeepSeek R1 (70B) - Best reasoning', category: 'reasoning' },
  { name: 'qwq', size: '20 GB', description: 'Alibaba QwQ (32B) - Reasoning', category: 'reasoning' },
  
  // === VISION ===
  { name: 'llama3.2-vision', size: '7.9 GB', description: 'Meta Llama 3.2 Vision (11B)', category: 'vision' },
  { name: 'llama3.2-vision:90b', size: '55 GB', description: 'Meta Llama 3.2 Vision (90B)', category: 'vision' },
  { name: 'granite3.2-vision', size: '2.4 GB', description: 'IBM Granite Vision (2B)', category: 'vision' },
  { name: 'granite3.2-vision:3b', size: '4.9 GB', description: 'IBM Granite Vision (3B)', category: 'vision' },
  { name: 'llava', size: '4.5 GB', description: 'LLaVA 1.5 (7B) - Vision', category: 'vision' },
  { name: 'llava:13b', size: '8.0 GB', description: 'LLaVA 1.5 (13B) - Vision', category: 'vision' },
  { name: 'llava-llama3', size: '5.5 GB', description: 'LLaVA with Llama 3 (8B)', category: 'vision' },
  { name: 'moondream', size: '1.7 GB', description: 'Moondream 2 - Small vision', category: 'vision' },
  { name: 'minicpm-v', size: '5.5 GB', description: 'MiniCPM-V (8B) - Vision', category: 'vision' },
  
  // === CODE ===
  { name: 'codellama', size: '3.8 GB', description: 'Code Llama (7B)', category: 'code' },
  { name: 'codellama:13b', size: '7.4 GB', description: 'Code Llama (13B)', category: 'code' },
  { name: 'codellama:34b', size: '19 GB', description: 'Code Llama (34B)', category: 'code' },
  { name: 'codegemma', size: '5.0 GB', description: 'Google CodeGemma (7B)', category: 'code' },
  { name: 'qwen2.5-coder', size: '4.7 GB', description: 'Qwen 2.5 Coder (7B)', category: 'code' },
  { name: 'qwen2.5-coder:1.5b', size: '986 MB', description: 'Qwen 2.5 Coder (1.5B) - Fast', category: 'code' },
  { name: 'qwen2.5-coder:14b', size: '9.0 GB', description: 'Qwen 2.5 Coder (14B)', category: 'code' },
  { name: 'qwen2.5-coder:32b', size: '20 GB', description: 'Qwen 2.5 Coder (32B)', category: 'code' },
  { name: 'starcoder2', size: '1.7 GB', description: 'StarCoder 2 (3B)', category: 'code' },
  { name: 'starcoder2:7b', size: '4.0 GB', description: 'StarCoder 2 (7B)', category: 'code' },
  { name: 'starcoder2:15b', size: '9.0 GB', description: 'StarCoder 2 (15B)', category: 'code' },
  { name: 'deepseek-coder-v2', size: '8.9 GB', description: 'DeepSeek Coder V2 (16B)', category: 'code' },
  
  // === EMBEDDINGS ===
  { name: 'nomic-embed-text', size: '274 MB', description: 'Nomic Text Embeddings', category: 'embedding' },
  { name: 'mxbai-embed-large', size: '669 MB', description: 'MixedBread Embeddings', category: 'embedding' },
  { name: 'all-minilm', size: '45 MB', description: 'All MiniLM (small)', category: 'embedding' },
  { name: 'snowflake-arctic-embed', size: '669 MB', description: 'Snowflake Embeddings', category: 'embedding' },
  
  // === SPECIALIZED ===
  { name: 'llama-guard3', size: '4.5 GB', description: 'Meta Llama Guard 3 - Safety', category: 'specialized' },
  { name: 'dolphin-mixtral', size: '26 GB', description: 'Dolphin Mixtral - Uncensored', category: 'specialized' },
  { name: 'dolphin-llama3', size: '4.7 GB', description: 'Dolphin Llama 3 - Uncensored', category: 'specialized' },
  { name: 'neural-chat', size: '4.1 GB', description: 'Intel Neural Chat (7B)', category: 'specialized' },
  { name: 'openchat', size: '4.1 GB', description: 'OpenChat 3.5 (7B)', category: 'specialized' },
  { name: 'yi', size: '4.5 GB', description: '01.AI Yi (6B)', category: 'specialized' },
  { name: 'solar', size: '6.1 GB', description: 'Upstage Solar (10.7B)', category: 'specialized' },
  { name: 'command-r', size: '20 GB', description: 'Cohere Command R (35B)', category: 'specialized' },
];

// GET - List available models to pull (suggestions)
export async function GET() {
  return apiSuccess({ models: POPULAR_MODELS });
}

// POST - Start pulling a model (returns streaming response)
export async function POST(request: Request) {
  try {
    const { model, host } = await request.json();

    if (!model) {
      return apiError('Model name required', 400);
    }

    let baseUrl: string;
    try {
      baseUrl = resolveAndValidateOllamaHost(host);
    } catch (err) {
      return apiError(err instanceof Error ? err.message : 'Invalid Ollama host', 400);
    }

    // Start pull request to Ollama
    const response = await ollamaFetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true }),
    });
    
    if (!response.ok) {
      return apiError(`Ollama error: ${response.status}`, response.status);
    }
    
    // Stream the response
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const text = decoder.decode(value);
            const lines = text.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                // Forward progress data
                controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('Pull error:', error);
    return apiError('Failed to pull model', 500);
  }
}
