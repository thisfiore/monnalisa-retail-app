import { describe, it, expect } from 'vitest';
import { recoveryLang, recoveryCopy, RECOVERY_COPY } from '../../lib/import/recovery-copy.ts';

describe('recoveryLang', () => {
  it('maps it_* locales to Italian', () => {
    expect(recoveryLang('it_IT')).toBe('it');
    expect(recoveryLang('it_CH')).toBe('it');
    expect(recoveryLang('IT_it')).toBe('it'); // case-insensitive
  });

  it('falls back to English for any non-Italian or missing locale', () => {
    expect(recoveryLang('en_GB')).toBe('en');
    expect(recoveryLang('fr_CH')).toBe('en');
    expect(recoveryLang('de_DE')).toBe('en');
    expect(recoveryLang(undefined)).toBe('en');
    expect(recoveryLang('')).toBe('en');
  });
});

describe('recoveryCopy', () => {
  it('returns the matching bundle and interpolates names', () => {
    expect(recoveryCopy('it_IT')).toBe(RECOVERY_COPY.it);
    expect(recoveryCopy('en_GB')).toBe(RECOVERY_COPY.en);
    expect(RECOVERY_COPY.it.doneTitle('Marco')).toBe('Grazie, Marco!');
    expect(RECOVERY_COPY.en.doneTitle('')).toBe('Thank you!');
    expect(RECOVERY_COPY.it.intro.greeting('Anna')).toBe('Ciao Anna!');
    expect(RECOVERY_COPY.en.greeting('')).toBe('Welcome');
  });

  it('keeps the two bundles structurally in sync (same benefit count)', () => {
    expect(RECOVERY_COPY.it.intro.benefits).toHaveLength(RECOVERY_COPY.en.intro.benefits.length);
  });
});
