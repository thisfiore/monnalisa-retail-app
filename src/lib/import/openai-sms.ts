import { getOpenAiClient, OPENAI_MODEL } from './openai-client';
import { smsLangForLocale } from './sms-message';
import type { StagingCustomer } from './types';

/**
 * AI personalisation for the recovery-outreach SMS. Produces ONE short message
 * body in the customer's language, following the house pattern (warm, premium,
 * not spammy). The manager can edit the result before sending, and the system
 * appends the recovery link afterwards — so the model must NOT write a link.
 */

const SYSTEM_PROMPT = `You write ONE short outreach SMS for Monnalisa, an Italian premium children's-clothing brand. The SMS invites an EXISTING customer to complete their missing profile data and join the loyalty programme through a link.

Rules:
- Write in the customer's language (given as "language"/"locale"). Tone: warm, premium, personal — never pushy, salesy, or spammy.
- Address the customer by first name if one is provided; otherwise stay natural without a placeholder.
- Do NOT include any URL, link, or a "{link}" placeholder — the system appends the recovery link automatically after your text.
- Keep it to a single SMS: aim for <= 140 characters so there is room for the link.
- At most one emoji, and only if it feels natural. No ALL CAPS, no exclamation pile-ups.
- Return ONLY the message text — no quotes, no preamble, no explanation.`;

export async function personaliseSmsBody(rec: StagingCustomer): Promise<string> {
  const lang = smsLangForLocale(rec.normalized.locale);
  const completion = await getOpenAiClient().chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          firstName: rec.normalized.firstName || null,
          locale: rec.normalized.locale,
          language: lang,
          store: rec.normalized.csvStore || null,
        }),
      },
    ],
    temperature: 0.7,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenAI returned an empty message');
  // Strip wrapping quotes the model sometimes adds despite instructions.
  return text.replace(/^["'“”']+|["'“”']+$/g, '').trim();
}
