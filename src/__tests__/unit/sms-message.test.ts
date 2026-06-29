import { describe, it, expect } from 'vitest';
import {
  NAME_PLACEHOLDER,
  defaultSmsBody,
  renderSmsBody,
  composeSms,
  smsLangForLocale,
  smsLength,
} from '../../lib/import/sms-message.ts';

describe('smsLangForLocale', () => {
  it('maps supported locale prefixes to their language', () => {
    expect(smsLangForLocale('it_IT')).toBe('it');
    expect(smsLangForLocale('it_CH')).toBe('it');
    expect(smsLangForLocale('fr_CH')).toBe('fr');
    expect(smsLangForLocale('de_DE')).toBe('de');
    expect(smsLangForLocale('es_ES')).toBe('es');
    expect(smsLangForLocale('en_GB')).toBe('en');
  });

  it('falls back to English for unsupported or missing locales', () => {
    expect(smsLangForLocale('ru_RU')).toBe('en');
    expect(smsLangForLocale('zh_CN')).toBe('en');
    expect(smsLangForLocale(undefined)).toBe('en');
    expect(smsLangForLocale('')).toBe('en');
  });
});

describe('default body + rendering', () => {
  it('every default body uses the official Monnalisa Fun brand copy', () => {
    for (const lang of ['it', 'en', 'fr', 'de', 'es'] as const) {
      const body = defaultSmsBody(lang);
      expect(body).toContain('Monnalisa Fun');
      // The link is appended by composeSms, so the body must never carry it.
      expect(body).not.toContain('http');
    }
  });

  it('renderSmsBody substitutes the first name', () => {
    expect(renderSmsBody(`Ciao ${NAME_PLACEHOLDER}, benvenuto`, 'Marco')).toBe(
      'Ciao Marco, benvenuto',
    );
  });

  it('collapses cleanly when no name is available', () => {
    expect(renderSmsBody(`Ciao ${NAME_PLACEHOLDER}, benvenuto`, '')).toBe('Ciao, benvenuto');
    expect(renderSmsBody(`Hi ${NAME_PLACEHOLDER}, welcome`, undefined)).toBe('Hi, welcome');
  });
});

describe('composeSms', () => {
  it('appends the link on its own line and never inside the body', () => {
    const out = composeSms(`Hi ${NAME_PLACEHOLDER}`, 'Ada', 'https://x.test/recover/abc');
    expect(out).toBe('Hi Ada\nhttps://x.test/recover/abc');
    const [body, link] = out.split('\n');
    expect(body).not.toContain('http');
    expect(link).toBe('https://x.test/recover/abc');
  });
});

describe('smsLength', () => {
  it('treats a short ASCII message as one GSM-7 segment', () => {
    const r = smsLength('Hello there');
    expect(r.encoding).toBe('GSM-7');
    expect(r.segments).toBe(1);
    expect(r.length).toBe(11);
  });

  it('splits a long ASCII message into multiple segments', () => {
    const r = smsLength('a'.repeat(200));
    expect(r.encoding).toBe('GSM-7');
    expect(r.segments).toBe(2);
  });

  it('switches to UCS-2 when a non-GSM character (emoji) is present', () => {
    const r = smsLength('Ciao 👶');
    expect(r.encoding).toBe('UCS-2');
    expect(r.segments).toBe(1);
  });
});
