import OpenAI from 'openai';

/**
 * Shared browser OpenAI client for the import workspace (AI repair + SMS copy).
 *
 * PROTOTYPE-ONLY: `VITE_OPENAI_API_KEY` ships to the browser. Before any
 * non-prototype use, move these calls server-side (Vercel function under
 * `api/`, mirroring `api/proxy.ts`) so the key never reaches clients.
 */

const MODEL = 'gpt-4o-mini';
export const OPENAI_MODEL = MODEL;

let client: OpenAI | null = null;

export function getOpenAiClient(): OpenAI {
  if (client) return client;
  // Browser: Vite injects import.meta.env. Node (offline batch scripts): fall
  // back to process.env so the same `repairRecord` runs in both contexts.
  const viteKey = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_OPENAI_API_KEY;
  const nodeKey =
    typeof process !== 'undefined'
      ? process.env.VITE_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
      : undefined;
  const apiKey = viteKey ?? nodeKey;
  if (!apiKey) {
    throw new Error(
      'VITE_OPENAI_API_KEY is not set. Add it to .env.local to enable AI features in the import workspace.',
    );
  }
  client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  return client;
}
