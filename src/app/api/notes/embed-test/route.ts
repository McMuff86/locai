import { NextRequest } from 'next/server';
import { resolveAndValidateOllamaHost } from '../../_utils/ollama';
import { apiError, apiSuccess } from '../../_utils/responses';

export const runtime = 'nodejs';

// Simple test endpoint to debug embedding issues
export async function POST(req: NextRequest) {
  const body = await req.json();
  const text: string = body.text || 'Test embedding';
  const model: string = body.model || 'nomic-embed-text';

  let host: string;
  try {
    host = resolveAndValidateOllamaHost(body.host);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Invalid Ollama host', 400);
  }

  const results: string[] = [];
  
  try {
    results.push(`[1] Starting test with text length: ${text.length}`);
    results.push(`[2] Host: ${host}, Model: ${model}`);
    
    // Step 1: Test basic fetch
    results.push('[3] Testing Ollama connection...');
    
    const testResponse = await fetch(`${host}/api/tags`);
    if (!testResponse.ok) {
      return apiError('Ollama nicht erreichbar', 500, { results });
    }
    results.push('[4] Ollama connection OK');
    
    // Step 2: Prepare request
    const requestBody = JSON.stringify({ 
      model, 
      prompt: text.slice(0, 500) // Limit for test
    });
    results.push(`[5] Request body length: ${requestBody.length}`);
    
    // Step 3: Make embedding request
    results.push('[6] Sending embedding request...');
    
    const embeddingResponse = await fetch(`${host}/api/embeddings`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: requestBody,
    });
    
    results.push(`[7] Response status: ${embeddingResponse.status}`);
    results.push(`[8] Response headers: ${JSON.stringify(Object.fromEntries(embeddingResponse.headers))}`);
    
    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      return apiError(`API Error: ${embeddingResponse.status}`, 500, { errorText, results });
    }
    
    // Step 4: Read response
    results.push('[9] Reading response body...');
    
    const responseText = await embeddingResponse.text();
    results.push(`[10] Response text length: ${responseText.length}`);
    results.push(`[11] Response preview: ${responseText.slice(0, 200)}`);
    
    // Step 5: Parse JSON
    results.push('[12] Parsing JSON...');
    
    let data;
    try {
      data = JSON.parse(responseText);
      results.push('[13] JSON parsed successfully');
    } catch (parseErr) {
      return apiError(`JSON parse error: ${parseErr}`, 500, { responseText: responseText.slice(0, 500), results });
    }
    
    // Step 6: Check embedding
    results.push('[14] Checking embedding array...');
    
    if (!data.embedding) {
      return apiError('No embedding in response', 500, { data, results });
    }

    if (!Array.isArray(data.embedding)) {
      return apiError(`embedding is not array: ${typeof data.embedding}`, 500, { results });
    }
    
    results.push(`[15] Embedding dimensions: ${data.embedding.length}`);
    results.push(`[16] First 3 values: ${data.embedding.slice(0, 3)}`);
    
    return apiSuccess({ embeddingLength: data.embedding.length, results });
    
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : String(err),
      500,
      { stack: err instanceof Error ? err.stack : undefined, results },
    );
  }
}

