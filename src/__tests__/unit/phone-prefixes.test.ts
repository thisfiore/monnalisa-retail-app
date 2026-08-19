import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PHONE_PREFIX,
  PHONE_PREFIXES,
  countryForPrefix,
  flagEmoji,
  isKnownPhonePrefix,
  matchesPrefixQuery,
  phonePrefixOptions,
  splitPhoneNumber,
} from '../../lib/phone-prefixes.ts';

describe('PHONE_PREFIXES table', () => {
  it('covers the whole world, not the old nine-prefix shortlist', () => {
    expect(PHONE_PREFIXES.length).toBeGreaterThan(200);
    // Nationalities the old hard-coded list silently forced onto a wrong code.
    for (const code of ['+90', '+7', '+32', '+31', '+971', '+55', '+91'])
      expect(isKnownPhonePrefix(code)).toBe(true);
  });

  it('has unique ISO codes and well-formed E.164 dialing codes', () => {
    const isos = PHONE_PREFIXES.map((p) => p.iso);
    expect(new Set(isos).size).toBe(isos.length);
    for (const p of PHONE_PREFIXES) expect(p.code).toMatch(/^\+[1-9]\d{0,2}$/);
  });

  it('keeps assigned codes prefix-free, so longest-match is unambiguous', () => {
    const codes = [...new Set(PHONE_PREFIXES.map((p) => p.code.slice(1)))];
    for (const a of codes)
      for (const b of codes)
        if (a !== b) expect(b.startsWith(a)).toBe(false);
  });

  it('renders flags from the ISO code', () => {
    expect(flagEmoji('IT')).toBe('🇮🇹');
    expect(flagEmoji('jp')).toBe('🇯🇵');
  });
});

describe('splitPhoneNumber', () => {
  it('splits an international number on its country code', () => {
    expect(splitPhoneNumber('+39 333 123 1231')).toEqual({ prefix: '+39', national: '3331231231' });
    expect(splitPhoneNumber('+1 (415) 555-0100')).toEqual({ prefix: '+1', national: '4155550100' });
    expect(splitPhoneNumber('+905321234567')).toEqual({ prefix: '+90', national: '5321234567' });
  });

  it('prefers the longest matching code', () => {
    expect(splitPhoneNumber('+378 0549 123456').prefix).toBe('+378'); // San Marino, not +37
    expect(splitPhoneNumber('+852 9123 4567').prefix).toBe('+852'); // Hong Kong, not +85
  });

  it('accepts the "00" international prefix', () => {
    expect(splitPhoneNumber('0044 7700 900123')).toEqual({ prefix: '+44', national: '7700900123' });
  });

  it('falls back to the default prefix for a bare national number', () => {
    expect(splitPhoneNumber('333 1231231')).toEqual({ prefix: DEFAULT_PHONE_PREFIX, national: '3331231231' });
    expect(splitPhoneNumber('')).toEqual({ prefix: DEFAULT_PHONE_PREFIX, national: '' });
    expect(splitPhoneNumber('333 1231231', '+44').prefix).toBe('+44');
  });

  it('round-trips what the forms send back to the API', () => {
    const { prefix, national } = splitPhoneNumber('+81 90-1234-5678');
    expect(`${prefix} ${national}`.replace(/\s/g, '')).toBe('+819012345678');
  });
});

describe('picker helpers', () => {
  it('lists the common markets first and never repeats them', () => {
    const { common, rest } = phonePrefixOptions();
    expect(common.map((p) => p.code)).toEqual(['+39', '+1', '+44', '+33', '+49', '+34', '+41', '+86', '+81']);
    expect(rest.some((p) => common.includes(p))).toBe(false);
    expect(common.length + rest.length).toBe(PHONE_PREFIXES.length);
  });

  it('names a picked code', () => {
    expect(countryForPrefix('+39')?.name).toBe('Italy');
    expect(countryForPrefix('+999')).toBeUndefined();
  });

  it('searches by name, ISO code and dialing code', () => {
    const turkey = PHONE_PREFIXES.find((p) => p.iso === 'TR')!;
    expect(matchesPrefixQuery(turkey, 'türk')).toBe(true);
    expect(matchesPrefixQuery(turkey, 'turk')).toBe(true); // accent-insensitive
    expect(matchesPrefixQuery(turkey, 'TR')).toBe(true);
    expect(matchesPrefixQuery(turkey, '+90')).toBe(true);
    expect(matchesPrefixQuery(turkey, 'italy')).toBe(false);
  });
});
