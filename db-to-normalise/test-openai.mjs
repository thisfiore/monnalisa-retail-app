// One-shot smoke test for the AI repair pass. Mirrors src/lib/import/openai-normalize.ts.
// Run: node db-to-normalise/test-openai.mjs   (reads key from .env.local)
import OpenAI from 'openai';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const key = env.match(/VITE_OPENAI_API_KEY=(.+)/)?.[1]?.trim();
if (!key) throw new Error('VITE_OPENAI_API_KEY not found in .env.local');

const client = new OpenAI({ apiKey: key });

const SYSTEM_PROMPT = `You are a data-normalization assistant for a children's-clothing retailer migrating legacy retail-store customer records into a new loyalty CRM. The system already did deterministic cleanup. Find further repairable issues: obvious email typos, phone numbers missing a country code that can be inferred from the country, odd name capitalization, locale corrections. Do NOT invent data. If a field is missing entirely, leave it null and explain in suggestedActions. Children's data is never in the source. hopeless=true only if there's no useful contact data at all.`;

const REPAIR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    patches: {
      type: 'object',
      additionalProperties: false,
      properties: {
        firstName: { type: ['string', 'null'] },
        lastName: { type: ['string', 'null'] },
        email: { type: ['string', 'null'] },
        phone: { type: ['string', 'null'] },
        locale: { type: ['string', 'null'] },
      },
      required: ['firstName', 'lastName', 'email', 'phone', 'locale'],
    },
    confidence: { type: 'number' },
    reasoning: { type: 'string' },
    suggestedActions: { type: 'array', items: { type: 'string' } },
    hopeless: { type: 'boolean' },
  },
  required: ['patches', 'confidence', 'reasoning', 'suggestedActions', 'hopeless'],
};

// A realistic dirty record: Italian customer, phone missing +39, email typo.
const record = {
  source: {
    country: 'Italy', store: 'Forte dei Marmi', customerId: '110000451',
    customerFullName: 'ROSSI MARIA', email: 'maria.rossi@gmial.con',
    phone1: '3331234567', compleanno1: '05/03/2026',
  },
  normalized: {
    firstName: 'Maria', lastName: 'Rossi', email: 'maria.rossi@gmial.con',
    phone: '3331234567', country: 'Italy', locale: 'it_IT',
  },
  flags: { emailInvalid: false, phoneNotE164: true, phoneMissing: false, emailMissing: false },
};

const t0 = Date.now();
const completion = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(record) },
  ],
  response_format: {
    type: 'json_schema',
    json_schema: { name: 'repair_result', strict: true, schema: REPAIR_SCHEMA },
  },
  temperature: 0.1,
});

const ms = Date.now() - t0;
console.log('--- INPUT (dirty record) ---');
console.log('email:', record.normalized.email, '| phone:', record.normalized.phone);
console.log('\n--- AI RESPONSE (' + ms + 'ms) ---');
console.log(completion.choices[0].message.content);
console.log('\n--- USAGE ---');
console.log(completion.usage);
