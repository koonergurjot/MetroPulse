import { describe, expect, it } from 'vitest';
import { MAX_PORTFOLIO_ROWS, parseCsv, parsePortfolioInput, toCsv } from './csv.ts';

describe('parseCsv', () => {
  it('handles quotes, commas, escaped quotes and CRLF', () => {
    expect(parseCsv('a,"b,c","d ""q"""\r\n1,2,3\r\n')).toEqual([['a', 'b,c', 'd "q"'], ['1', '2', '3']]);
  });
});

describe('parsePortfolioInput', () => {
  it('reads name and address columns, dedupes, skips blanks', () => {
    const { rows, warnings } = parsePortfolioInput('Site,Address\nHouse A,"800 Robson St, Vancouver"\nHouse B,"800  robson st, vancouver"\n,\nHouse C,4949 Canada Way Burnaby');
    expect(rows.map((r) => r.address)).toEqual(['800 Robson St, Vancouver', '4949 Canada Way Burnaby']);
    expect(rows[0].name).toBe('House A');
    expect(warnings.join()).toMatch(/duplicate/);
  });
  it('accepts a plain list of addresses', () => {
    const { rows } = parsePortfolioInput('800 Robson St, Vancouver\n4949 Canada Way, Burnaby');
    expect(rows).toHaveLength(2);
  });
  it('caps the row count', () => {
    const text = 'address\n' + Array.from({ length: 150 }, (_, i) => `${i + 1} Main St, Vancouver`).join('\n');
    const { rows, warnings } = parsePortfolioInput(text);
    expect(rows).toHaveLength(MAX_PORTFOLIO_ROWS);
    expect(warnings.join()).toMatch(/first 100/);
  });
  it('reports an empty import', () => {
    expect(parsePortfolioInput('   ').rows).toEqual([]);
  });
});

describe('toCsv', () => {
  it('quotes fields and neutralises spreadsheet formulas', () => {
    const out = toCsv(['a', 'b'], [['x,y', '=HYPERLINK("evil")'], [1, null]]);
    expect(out).toBe('a,b\r\n"x,y","\'=HYPERLINK(""evil"")"\r\n1,');
  });
});
