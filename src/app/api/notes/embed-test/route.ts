import { NextRequest, NextResponse } from 'next/server';
import { validateOllamaHost } from '../../_utils/security';

export const runtime = 'nodejs';

const DEFAULT_HOST = 'http://localhost:11434';

// Simple test endpoint to debug embedding issues
export async function POST(req: NextRequest) {
  const body = await req.json();
  const text: string = body.text || 'Test embedding';
  const model: string = body.model || 'nomic-embed-text';

  // SSRF: validate user-supplied Ollama host
  const rawHost = body.host || DEFAULT_HOST;
  const hostCheck = validateOllamaHost(rawHost);
  if (!hostCheck.valid) {
    return NextResponse.json({ success: false, error: hostCheck.reason }, { status: 400 });
  }
  const host: string = hostCheck.url;

  const results: string[] = [];
  
  try {
    results.push(`[1] Starting test with text length: ${text.length}`);
    results.push(`[2] Host: ${host}, Model: ${model}`);
    
    // Step 1: Test basic fetch
    results.push('[3] Testing Ollama connection...');
    
    const testResponse = await fetch(`${host}/api/tags`);
    if (!testResponse.ok) {
      return NextResponse.json({ 
        success: false, 
        error: 'Ollama nicht erreichbar',
        results 
      });
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
      return NextResponse.json({ 
        success: false, 
        error: `API Error: ${embeddingResponse.status}`,
        errorText,
        results 
      });
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
      return NextResponse.json({ 
        success: false, 
        error: `JSON parse error: ${parseErr}`,
        responseText: responseText.slice(0, 500),
        results 
      });
    }
    
    // Step 6: Check embedding
    results.push('[14] Checking embedding array...');
    
    if (!data.embedding) {
      return NextResponse.json({ 
        success: false, 
        error: 'No embedding in response',
        data,
        results 
      });
    }
    
    if (!Array.isArray(data.embedding)) {
      return NextResponse.json({ 
        success: false, 
        error: `embedding is not array: ${typeof data.embedding}`,
        results 
      });
    }
    
    results.push(`[15] Embedding dimensions: ${data.embedding.length}`);
    results.push(`[16] First 3 values: ${data.embedding.slice(0, 3)}`);
    
    return NextResponse.json({ 
      success: true, 
      embeddingLength: data.embedding.length,
      results 
    });
    
  } catch (err) {
    return NextResponse.json({ 
      success: false, 
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      results 
    });
  }
}

