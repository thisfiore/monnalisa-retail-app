import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseLegacyCsv } from '../../lib/import/csv-parse.ts';
import {
  dedupAndNormalize,
  splitLegacyName,
  parseCompleanno,
  mapCsvCountry,
} from '../../lib/import/normalize.ts';
import { resolveLocale } from '../../lib/import/locale.ts';
import { parseRetailCsv, isRetailCsv } from '../../lib/import/retail-parse.ts';
import {
  buildStagingFromRetail,
  normalizeRetailRow,
  storeCountryFromSub,
} from '../../lib/import/retail-normalize.ts';
import type { RawRetailRow } from '../../lib/import/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE = resolve(__dirname, '../../../db-to-normalise/sample.csv');

function retailRow(over: Partial<RawRetailRow> = {}): RawRetailRow {
  return {
    custSid: '-123', custId: '1000', first: 'Mario', last: 'Rossi',
    storeName: 'Arezzo', sub: '001_OUTLET_ITA', countryCode: 'USA',
    email: '', phone1: '', phone2: '', compl1: '', compl2: '',
    firstSaleDate: '', lastSaleDate: '', totalSales: '', totalUnits: '',
    ytdSales: '', storeCredit: '', dateExcelSerial: '0', ...over,
  };
}
const CTX = { storeId: 'store1', importId: 'imp1', now: 0 };

describe('splitLegacyName', () => {
  it('splits "LASTNAME FIRSTNAME" with title-casing', () => {
    expect(splitLegacyName('SOK LUDMILA')).toEqual({
      lastName: 'Sok',
      firstName: 'Ludmila',
    });
  });

  it('handles single-token names by putting them in lastName', () => {
    expect(splitLegacyName('MADONNA')).toEqual({ lastName: 'Madonna', firstName: '' });
  });

  it('returns empty for placeholders', () => {
    expect(splitLegacyName('-')).toEqual({ lastName: '', firstName: '' });
    expect(splitLegacyName('')).toEqual({ lastName: '', firstName: '' });
  });

  it('preserves O\'connor-style apostrophes', () => {
    expect(splitLegacyName("O'CONNOR LIAM")).toEqual({
      lastName: "O'Connor",
      firstName: 'Liam',
    });
  });
});

describe('parseCompleanno', () => {
  it('extracts DD/MM and flags year as unknown for the 2026 placeholder', () => {
    const c = parseCompleanno('05/03/2026');
    expect(c).toEqual({ dayMonth: '05/03', yearKnown: false });
  });

  it('keeps the year when it is not the 2026 placeholder', () => {
    const c = parseCompleanno('15/06/2020');
    expect(c).toEqual({ dayMonth: '15/06', yearKnown: true, year: 2020 });
  });

  it('returns null for placeholders', () => {
    expect(parseCompleanno('-')).toBeNull();
    expect(parseCompleanno('')).toBeNull();
  });
});

describe('mapCsvCountry', () => {
  it('aliases USA → United States', () => {
    expect(mapCsvCountry('USA')).toEqual({ country: 'United States', locale: 'en_US' });
  });
  it('aliases UK → United Kingdom', () => {
    expect(mapCsvCountry('UK')).toEqual({ country: 'United Kingdom', locale: 'en_GB' });
  });
  it('passes Italy through directly', () => {
    expect(mapCsvCountry('Italy')).toEqual({ country: 'Italy', locale: 'it_IT' });
  });
  it('falls back to it_IT for unknown countries', () => {
    expect(mapCsvCountry('Atlantis')).toEqual({ country: 'Atlantis', locale: 'it_IT' });
  });
});

describe('resolveLocale', () => {
  it('prefers an explicit phone country code over the store country', () => {
    // French tourist shopping at an Italian store.
    const r = resolveLocale({ storeCountry: 'Italy', phones: ['+33 6 38 64 50 29'], name: 'Dupont Marie' });
    expect(r).toMatchObject({ locale: 'fr_FR', source: 'phone' });
  });

  it('maps a "00"-prefixed international number too', () => {
    const r = resolveLocale({ storeCountry: 'Italy', phones: ['0044 7700 900123'], name: 'Smith John' });
    expect(r).toMatchObject({ locale: 'en_GB', source: 'phone' });
  });

  it('falls back to English for an international prefix with no supported locale', () => {
    // Russian (+7) — no ru_RU locale supported.
    const r = resolveLocale({ storeCountry: 'Italy', phones: ['+7 495 1234567'], name: 'Ivanov' });
    expect(r).toMatchObject({ locale: 'en_GB', source: 'phone' });
  });

  it('detects a Han-script name as Chinese, even at an Italian store', () => {
    const r = resolveLocale({ storeCountry: 'Italy', phones: [], name: '陈 女士' });
    expect(r).toMatchObject({ locale: 'zh_CN', source: 'name-script' });
  });

  it('routes a Cyrillic name to English (no Russian locale)', () => {
    const r = resolveLocale({ storeCountry: 'Russia', phones: [], name: 'РАСПУТИНА ИРИНА' });
    expect(r).toMatchObject({ locale: 'en_GB', source: 'name-script' });
  });

  it('accepts a bare Italian mobile as positive Italian evidence', () => {
    const r = resolveLocale({ storeCountry: 'Italy', phones: ['3388458363'], name: 'Rossi Mario' });
    expect(r).toMatchObject({ locale: 'it_IT', source: 'store' });
  });

  it('does NOT assume Italian for an email-only Latin name at an Italian store', () => {
    const r = resolveLocale({ storeCountry: 'Italy', phones: [], name: 'Schockaert Amelie' });
    expect(r).toMatchObject({ locale: 'en_GB', source: 'fallback' });
  });

  it('trusts a non-tourist store country', () => {
    expect(resolveLocale({ storeCountry: 'United States', phones: [], name: 'Smith' })).toMatchObject({
      locale: 'en_US',
      source: 'store',
    });
    expect(resolveLocale({ storeCountry: 'China', phones: [], name: 'Smith' })).toMatchObject({
      locale: 'zh_CN',
      source: 'store',
    });
  });

  it('falls back to English (not Italian) for an unknown store country', () => {
    const r = resolveLocale({ storeCountry: 'Atlantis', phones: [], name: 'Nemo' });
    expect(r).toMatchObject({ locale: 'en_GB', source: 'fallback' });
  });

  it('ignores an email accidentally landed in the phone column', () => {
    const r = resolveLocale({ storeCountry: 'Italy', phones: ['foo@bar.com'], name: 'Bianchi Luca' });
    expect(r.locale).toBe('en_GB'); // no usable phone, Latin name → fallback
  });
});

describe('retail import (no-email cohort)', () => {
  it('derives store country from the Sub store-group code', () => {
    expect(storeCountryFromSub('001_OUTLET_ITA')).toBe('Italy');
    expect(storeCountryFromSub('10_ITALIA_DOS')).toBe('Italy');
    expect(storeCountryFromSub('70_CHINA')).toBe('China');
    expect(storeCountryFromSub('69_OUTLET_USA')).toBe('United States');
    expect(storeCountryFromSub('66_MIAMI')).toBe('United States');
    expect(storeCountryFromSub('62_HONG KONG')).toBe('Hong Kong');
    expect(storeCountryFromSub('???')).toBe(''); // unknown → resolver falls back to English
  });

  it('keeps a bare Italian mobile at an Italian store as it_IT', () => {
    const n = normalizeRetailRow(retailRow({ phone1: '3392921821' }));
    expect(n.locale).toBe('it_IT');
    expect(n.firstName).toBe('Mario');
    expect(n.lastName).toBe('Rossi');
  });

  it('does NOT assume Italian for a phone-less Latin name at an Italian store', () => {
    const n = normalizeRetailRow(retailRow({ first: 'Amelie', last: 'Schockaert', phone1: '' }));
    expect(n.locale).toBe('en_GB');
    expect(n.localeSource).toBe('fallback');
  });

  it('detects a Han-script name as Chinese even at an Italian store', () => {
    const n = normalizeRetailRow(retailRow({ first: '女士', last: '陈' }));
    expect(n.locale).toBe('zh_CN');
  });

  it('ignores the polluted Country Code column entirely', () => {
    // countryCode says USA but it is an Arezzo (Italy) store with an Italian mobile.
    const n = normalizeRetailRow(retailRow({ countryCode: 'USA', phone1: '3334953588' }));
    expect(n.locale).toBe('it_IT');
  });

  it('parses Italian-formatted money and flags ambiguous dates', () => {
    const rec = buildStagingFromRetail(
      retailRow({ phone1: '3392921821', totalSales: '1.234,56', storeCredit: '0,00', dateExcelSerial: '1' }),
      CTX,
    );
    expect(rec.metrics?.totalSales).toBeCloseTo(1234.56);
    expect(rec.metrics?.storeCredit).toBe(0);
    expect(rec.metrics?.dateAmbiguous).toBe(true);
    expect(rec.custSid).toBe('-123');
    expect(rec.customerId).toBe('-123');
    expect(rec.sourceSchema).toBe('retail');
  });

  it('treats a future/sentinel birthday year as year-unknown', () => {
    const n = normalizeRetailRow(retailRow({ compl1: '01/01/2050', compl2: '17/11/2015' }));
    expect(n.children).toHaveLength(2);
    expect(n.children[0]).toEqual({ dayMonth: '01/01', yearKnown: false });
    expect(n.children[1]).toEqual({ dayMonth: '17/11', yearKnown: true, year: 2015 });
  });

  it('statuses: phone-only → review, nothing → blocked', () => {
    expect(buildStagingFromRetail(retailRow({ phone1: '3392921821' }), CTX).status).toBe('review');
    expect(buildStagingFromRetail(retailRow({ phone1: '', email: '' }), CTX).status).toBe('blocked');
  });

  it('E.164-normalises a confident Italian mobile and clears phoneNotE164', () => {
    const rec = buildStagingFromRetail(retailRow({ phone1: '3471682897' }), CTX);
    expect(rec.normalized.phone).toBe('+393471682897');
    expect(rec.flags.phoneNotE164).toBe(false);
  });

  it('leaves an explicit +39 / foreign number as-is', () => {
    expect(buildStagingFromRetail(retailRow({ phone1: '+39 334 860 9384' }), CTX).normalized.phone)
      .toBe('+393348609384');
    // A non-Italian (tourist) number is NOT stamped +39 — correctly stays not-E.164.
    const tourist = buildStagingFromRetail(
      retailRow({ first: 'John', last: 'Smith', sub: '69_OUTLET_USA', phone1: '2025551234' }),
      CTX,
    );
    expect(tourist.normalized.phone).toBe('2025551234');
    expect(tourist.flags.phoneNotE164).toBe(true);
  });

  it('parses a retail CSV, strips Cust SID quotes, and counts stores', () => {
    const csv = [
      'Cust SID;Cust ID;First;Last;Store Name;Sub;Country Code;Email;Phone1;Phone2;Compl 1;Compl 2;First Sale Dt;Last Sale Dt;Total Sales;Total Units;YTD Sales;Store Credit;date_excel_serial',
      '"-123";1000;Mario;Rossi;Arezzo;001_OUTLET_ITA;ITA;;3392921821;;;;;;0,00;0;0,00;0,00;0',
      '"-456";1001;Li;Wang;Milano;10_ITALIA_DOS;CHN;;;;;;;;0,00;0;0,00;0,00;0',
    ].join('\n');
    expect(isRetailCsv(csv)).toBe(true);
    const { rows, summary } = parseRetailCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].custSid).toBe('-123'); // quotes stripped
    expect(summary.csvStoresFound.map((s) => s.name).sort()).toEqual(['Arezzo', 'Milano']);
  });

  it('isRetailCsv is false for the legacy header', () => {
    expect(isRetailCsv('COUNTRY;STORE;TYPE;CUSTOMER ID;CUSTOMER FULL NAME')).toBe(false);
  });
});

describe('processed-CSV loader (offline AI results → app)', () => {
  const HEADER =
    'custSid,custId,importStore,storeName,sub,storeCountry,firstName,lastName,email,phone,phoneAlt,locale,localeSource,localeConfidence,localeReason,status,aiProcessed,aiLocaleChanged,aiConfidence,aiNotes,totalSales,totalUnits,ytdSales,storeCredit,firstSaleDate,lastSaleDate,dateAmbiguous,child1_dayMonth,child1_year,child2_dayMonth,child2_year,consentPrivacy,consentLoyalty,consentMarketing,processedAt';

  it('detects the processed schema and reconstructs a staging record with AI data', async () => {
    const { isProcessedCsv, parseProcessedCsv, normalizeProcessedRows } = await import(
      '../../lib/import/processed-parse.ts'
    );
    const row =
      '-5044576419462049796,1016840,Arezzo,Arezzo,001_OUTLET_ITA,Italy,Maria Luisa,Organai,,,,it_IT,fallback,0.80,"AI: clearly Italian name",blocked,true,true,0.8,"name is Italian / collect email",78,2,78,0,,,1,01/06,2018,,,,,,2026-06-18';
    const csv = `﻿${HEADER}\n${row}\n`;

    expect(isProcessedCsv(csv)).toBe(true);
    expect(isRetailCsv(csv)).toBe(false);

    const { rows } = parseProcessedCsv(csv);
    expect(rows).toHaveLength(1);

    const [rec] = normalizeProcessedRows(rows, { storeId: 's', importId: 'i', now: 0 });
    expect(rec.custSid).toBe('-5044576419462049796');
    expect(rec.customerId).toBe('-5044576419462049796');
    expect(rec.sourceSchema).toBe('retail');
    expect(rec.normalized.locale).toBe('it_IT');
    expect(rec.aiNotes).toContain('Italian');
    expect(rec.aiConfidence).toBeCloseTo(0.8);
    expect(rec.metrics?.totalSales).toBe(78);
    expect(rec.metrics?.dateAmbiguous).toBe(true);
    expect(rec.normalized.children).toEqual([{ dayMonth: '01/06', yearKnown: true, year: 2018 }]);
  });
});

describe('end-to-end pipeline against sample.csv', () => {
  const csvText = readFileSync(SAMPLE, 'utf-8');
  const { rows, summary } = parseLegacyCsv(csvText);

  it('parses the sample without losing rows to the Total summary', () => {
    expect(rows.length).toBeGreaterThan(300);
    expect(summary.totalRowDropped).toBe(false); // sample doesn't include the Total row
  });

  it('finds a realistic distribution of CSV stores', () => {
    expect(summary.csvStoresFound.length).toBeGreaterThan(5);
    const fortedeiMarmi = summary.csvStoresFound.find((s) => s.name === 'Forte dei Marmi');
    expect(fortedeiMarmi?.rowCount).toBeGreaterThan(50);
  });

  it('produces a deterministic dedup', () => {
    const customers = dedupAndNormalize(rows, {
      storeId: 'test-store',
      importId: 'test-import',
      now: 0,
    });
    expect(customers.length).toBeLessThanOrEqual(rows.length);
    // every record has either an email, a phone, OR neither (blocked); none have both
    // (legacy data quirk)
    const both = customers.filter((c) => c.normalized.email && c.normalized.phone);
    expect(both.length).toBe(0);
  });

  it('marks rows with neither contact channel as blocked, and the rest as review', () => {
    const customers = dedupAndNormalize(rows, {
      storeId: 'test-store',
      importId: 'test-import',
      now: 0,
    });
    const byStatus = customers.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {});
    expect(byStatus.blocked).toBeGreaterThan(0);
    expect(byStatus.review).toBeGreaterThan(0);
    // The legacy export has no rows with both email AND phone — so no "ready" rows.
    expect(byStatus.ready ?? 0).toBe(0);
  });

  it('extracts children day/month from COMPLEANNO 1/2 placeholders', () => {
    const customers = dedupAndNormalize(rows, {
      storeId: 'test-store',
      importId: 'test-import',
      now: 0,
    });
    const withChildren = customers.filter((c) => c.normalized.children.length > 0);
    expect(withChildren.length).toBeGreaterThan(0);
    for (const c of withChildren) {
      for (const child of c.normalized.children) {
        expect(child.dayMonth).toMatch(/^\d{2}\/\d{2}$/);
        // sample's COMPLEANNO values are 2026 placeholders, so yearKnown=false
        expect(child.yearKnown).toBe(false);
      }
    }
  });
});
