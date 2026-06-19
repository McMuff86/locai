import fs from 'fs';
import path from 'path';
import type { ProviderAuthMode, ProviderCredentialSource, ProviderType } from './types';

export interface StoredProviderCredential {
  provider: ProviderType;
  authMode: Exclude<ProviderAuthMode, 'none'>;
  credential: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedProviderCredential {
  provider: ProviderType;
  credential?: string;
  projectId?: string;
  authMode: ProviderAuthMode;
  source: ProviderCredentialSource;
  envVar?: string;
}

interface ProviderCredentialFile {
  version: 1;
  providers: Partial<Record<ProviderType, StoredProviderCredential>>;
}

function getLocaiDir(): string {
  const homeDir = process.env.USERPROFILE || process.env.HOME || '.';
  return path.join(homeDir, '.locai');
}

export function getProviderCredentialsPath(): string {
  return path.join(getLocaiDir(), 'provider-credentials.json');
}

function emptyCredentialFile(): ProviderCredentialFile {
  return { version: 1, providers: {} };
}

function readCredentialFile(): ProviderCredentialFile {
  const filePath = getProviderCredentialsPath();
  if (!fs.existsSync(filePath)) return emptyCredentialFile();

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ProviderCredentialFile;
  if (parsed?.version !== 1 || !parsed.providers || typeof parsed.providers !== 'object') {
    return emptyCredentialFile();
  }
  return parsed;
}

function writeCredentialFile(file: ProviderCredentialFile): void {
  const filePath = getProviderCredentialsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2), { encoding: 'utf-8', mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // chmod can fail on some Windows-backed filesystems; the file still stays under ~/.locai.
  }
}

export function readStoredProviderCredential(provider: ProviderType): StoredProviderCredential | null {
  try {
    const file = readCredentialFile();
    const credential = file.providers[provider];
    if (!credential?.credential || credential.provider !== provider) return null;
    return credential;
  } catch {
    return null;
  }
}

export function writeStoredProviderCredential(
  provider: ProviderType,
  authMode: Exclude<ProviderAuthMode, 'none'>,
  credential: string,
  options?: { projectId?: string },
): StoredProviderCredential {
  const now = new Date().toISOString();
  const file = readCredentialFile();
  const existing = file.providers[provider];
  const record: StoredProviderCredential = {
    provider,
    authMode,
    credential,
    projectId: options?.projectId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  file.providers[provider] = record;
  writeCredentialFile(file);
  return record;
}

export function deleteStoredProviderCredential(provider: ProviderType): boolean {
  const file = readCredentialFile();
  if (!file.providers[provider]) return false;
  delete file.providers[provider];
  writeCredentialFile(file);
  return true;
}

export function maskCredential(credential?: string): string | undefined {
  if (!credential) return undefined;
  if (credential.length <= 8) return 'configured';
  return `${credential.slice(0, 4)}...${credential.slice(-4)}`;
}
