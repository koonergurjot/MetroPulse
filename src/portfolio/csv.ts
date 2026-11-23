/** Minimal RFC 4180-ish CSV helpers for the portfolio tool. */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); if (row.some((c) => c.trim() !== '')) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') pushField();
    else if (ch === '\n') pushRow();
    else if (ch !== '\r') field += ch;
  }
  pushField();
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

export interface PortfolioInput {
  name: string;
  address: string;
}

export const MAX_PORTFOLIO_ROWS = 100;

/**
 * Accepts CSV with an "address" column (optional "name"/"site"/"property" column),
 * or a plain list with one address per line.
 */
export function parsePortfolioInput(text: string): { rows: PortfolioInput[]; warnings: string[] } {
  const warnings: string[] = [];
  const table = parseCsv(text.trim());
  if (table.length === 0) return { rows: [], warnings: ['Nothing to import.'] };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const addrIdx = header.findIndex((h) => h === 'address' || h === 'street address' || h === 'site address');
  const nameIdx = header.findIndex((h) => ['name', 'site', 'property', 'building', 'location'].includes(h));
  const hasHeader = addrIdx >= 0;
  const body = hasHeader ? table.slice(1) : table;
  const aIdx = hasHeader ? addrIdx : 0;

  let rows = body
    .map((r, i) => ({ name: (nameIdx >= 0 ? r[nameIdx] : '')?.trim() || `Row ${i + 1}`, address: (r[aIdx] ?? '').trim() }))
    .filter((r) => r.address !== '');

  const seen = new Set<string>();
  const before = rows.length;
  rows = rows.filter((r) => {
    const k = r.address.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (rows.length < before) warnings.push(`${before - rows.length} duplicate address(es) removed.`);
  if (rows.length > MAX_PORTFOLIO_ROWS) {
    warnings.push(`Only the first ${MAX_PORTFOLIO_ROWS} addresses will be checked.`);
    rows = rows.slice(0, MAX_PORTFOLIO_ROWS);
  }
  if (!hasHeader && table[0].length > 1) warnings.push('No "address" column found; using the first column.');
  return { rows, warnings };
}

/** Guards against CSV/formula injection when the export is opened in a spreadsheet. */
function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}
