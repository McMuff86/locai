import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getServerProviderCredentialStatus,
  resolveServerProviderCredential,
} from './server';
import { writeStoredProviderCredential } from './credentials';

const ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_ACCESS_TOKEN',
  'OPENAI_OAUTH_ACCESS_TOKEN',
  'OPENROUTER_API_KEY',
  'OPENROUTER_OAUTH_KEY',
  'OPENROUTER_ACCESS_TOKEN',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_OAUTH_ACCESS_TOKEN',
  'GOOGLE_OAUTH_ACCESS_TOKEN',
  'GOOGLE_CLOUD_ACCESS_TOKEN',
  'GOOGLE_CLOUD_PROJECT',
  'GOOGLE_PROJECT_ID',
  'GEMINI_PROJECT_ID',
  'HOME',
] as const;

const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};
let tempHome: string;

describe('server provider credential resolution', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'locai-provider-test-'));
    process.env.HOME = tempHome;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('treats ollama as configured without credentials', () => {
    const credential = resolveServerProviderCredential('ollama');
    expect(credential).toMatchObject({
      provider: 'ollama',
      authMode: 'none',
      source: 'none',
    });

    expect(getServerProviderCredentialStatus('ollama')).toMatchObject({
      configured: true,
      supportsOAuth: false,
    });
  });

  it('resolves OpenRouter OAuth credentials from the local store', () => {
    writeStoredProviderCredential('openrouter', 'oauth', 'sk-or-oauth-local');

    expect(resolveServerProviderCredential('openrouter')).toMatchObject({
      provider: 'openrouter',
      credential: 'sk-or-oauth-local',
      authMode: 'oauth',
      source: 'local_store',
    });
  });

  it('prefers environment API keys over local OAuth credentials', () => {
    writeStoredProviderCredential('openrouter', 'oauth', 'sk-or-oauth-local');
    process.env.OPENROUTER_API_KEY = 'sk-or-env';

    expect(resolveServerProviderCredential('openrouter')).toMatchObject({
      credential: 'sk-or-env',
      authMode: 'api_key',
      source: 'env',
      envVar: 'OPENROUTER_API_KEY',
    });
  });

  it('recognizes OpenAI workload identity access tokens', () => {
    process.env.OPENAI_ACCESS_TOKEN = 'openai-short-lived-token';

    expect(resolveServerProviderCredential('openai')).toMatchObject({
      credential: 'openai-short-lived-token',
      authMode: 'workload_identity',
      source: 'env',
      envVar: 'OPENAI_ACCESS_TOKEN',
    });
  });

  it('resolves Google OAuth tokens with project context', () => {
    process.env.GOOGLE_OAUTH_ACCESS_TOKEN = 'google-oauth-token';
    process.env.GOOGLE_CLOUD_PROJECT = 'locai-test-project';

    expect(resolveServerProviderCredential('google')).toMatchObject({
      credential: 'google-oauth-token',
      projectId: 'locai-test-project',
      authMode: 'oauth',
      source: 'env',
      envVar: 'GOOGLE_OAUTH_ACCESS_TOKEN',
    });
  });
});
