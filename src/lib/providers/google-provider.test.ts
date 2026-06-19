import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleGeminiProvider } from './google-provider';

describe('GoogleGeminiProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists Gemini models with OAuth bearer and user project headers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          {
            name: 'models/gemini-3.5-flash',
            displayName: 'Gemini 3.5 Flash',
            inputTokenLimit: 1048576,
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/gemini-embedding',
            displayName: 'Gemini Embedding',
            supportedGenerationMethods: ['embedContent'],
          },
        ],
      }),
    } as Response);

    const provider = new GoogleGeminiProvider({
      accessToken: 'oauth-token',
      authMode: 'oauth',
      projectId: 'locai-project',
    });

    const models = await provider.listModels();

    expect(models).toEqual([
      {
        id: 'gemini-3.5-flash',
        name: 'Gemini 3.5 Flash',
        provider: 'google',
        contextLength: 1048576,
        description: undefined,
        authMode: 'oauth',
      },
    ]);

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer oauth-token');
    expect(headers.get('x-goog-user-project')).toBe('locai-project');
  });

  it('extracts Gemini function calls as provider tool calls', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                { text: 'Ich lese die Datei.' },
                { functionCall: { name: 'read_file', args: { path: 'test.txt' } } },
              ],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      }),
    } as Response);

    const provider = new GoogleGeminiProvider({ apiKey: 'gemini-key' });
    const response = await provider.chat(
      [{ role: 'user', content: 'Lies test.txt' }],
      {
        model: 'gemini-3.5-flash',
        tools: [
          {
            type: 'function',
            function: {
              name: 'read_file',
              description: 'Read a file',
              parameters: {
                type: 'object',
                properties: { path: { type: 'string' } },
                required: ['path'],
              },
            },
          },
        ],
      },
    );

    expect(response.content).toBe('Ich lese die Datei.');
    expect(response.finishReason).toBe('tool_calls');
    expect(response.toolCalls?.[0]).toMatchObject({
      function: {
        name: 'read_file',
        arguments: { path: 'test.txt' },
      },
    });
    expect(response.usage?.totalTokens).toBe(15);
  });
});
