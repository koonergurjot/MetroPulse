import { describe, expect, it } from 'vitest';
import { renderOgCard, strongestComponents } from '../og.ts';
import type { ScoreComponent } from '../types.ts';

const components: ScoreComponent[] = [
  { key: 'transit_reliability', label: 'Transit reliability', weight: 0.35, score: 40, available: true, reason: 'r1' },
  { key: 'transit_access', label: 'Transit access', weight: 0.15, score: 92, available: true, reason: 'r2' },
  { key: 'quietness', label: 'Street-level disruption', weight: 0.2, score: 85, available: true, reason: 'r3' },
  { key: 'construction', label: 'Construction pressure', weight: 0.2, score: 0, available: false, reason: 'r4' },
  { key: 'building_care', label: 'Rental building standards', weight: 0.1, score: 60, available: true, reason: 'r5' },
];

describe('strongestComponents', () => {
  it('picks the highest-scoring available components, highest first', () => {
    const top = strongestComponents(components, 2);
    expect(top.map((c) => c.key)).toEqual(['transit_access', 'quietness']);
  });

  it('excludes unavailable components even if requested count would include them', () => {
    const top = strongestComponents(components, 5);
    expect(top.every((c) => c.available)).toBe(true);
    expect(top).toHaveLength(4);
  });

  it('returns an empty array when nothing is available', () => {
    expect(strongestComponents(components.map((c) => ({ ...c, available: false })))).toEqual([]);
  });
});

describe('renderOgCard', () => {
  it('renders a well-formed 1200x630 SVG document', () => {
    const svg = renderOgCard({ address: '555 W Hastings St, Vancouver, BC', score: 78, components });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('width="1200" height="630"');
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });

  it('includes the address, score, and the two strongest components', () => {
    const svg = renderOgCard({ address: '555 W Hastings St, Vancouver, BC', score: 78, components });
    expect(svg).toContain('555 W Hastings St, Vancouver, BC');
    expect(svg).toContain('>78<');
    expect(svg).toContain('Transit access');
    expect(svg).toContain('Street-level disruption');
    // The weakest available component (building_care, score 60) and the
    // unavailable one should not make the cut.
    expect(svg).not.toContain('Rental building standards');
    expect(svg).not.toContain('Construction pressure');
  });

  it('escapes XML-significant characters in the address so the SVG stays well-formed', () => {
    const svg = renderOgCard({ address: 'Tom & Jerry\'s <Diner>', score: 50, components: [] });
    expect(svg).not.toContain('<Diner>');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&lt;Diner&gt;');
  });

  it('renders a dash placeholder and neutral color when the score is withheld', () => {
    const svg = renderOgCard({ address: '123 Main St', score: null, components: [] });
    expect(svg).toContain('>—<');
  });

  it('wraps a long address onto multiple lines instead of overflowing', () => {
    const svg = renderOgCard({
      address: 'Unit 4200, 1234 West Georgia Street, Vancouver, British Columbia, Canada',
      score: 60,
      components: [],
    });
    const tspanCount = (svg.match(/<tspan/g) ?? []).length;
    expect(tspanCount).toBeGreaterThanOrEqual(2);
  });
});
