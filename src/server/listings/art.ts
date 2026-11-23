/**
 * Generated placeholder "photos" for demo listings.
 *
 * Demo listings must never hotlink or redistribute real listing photos, so the
 * demo provider serves deterministic SVG illustrations from our own origin.
 * A licensed provider returns its own photo URLs and this file goes unused.
 */

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES: Array<[string, string, string]> = [
  ['#1b2a49', '#e8825b', '#f6c177'], // dusk
  ['#0f3d3e', '#4fb3a5', '#d7f2e3'], // rainforest
  ['#2b2d6e', '#7f6df2', '#f4b8e4'], // twilight
  ['#14213d', '#fca311', '#ffe8b8'], // golden hour
  ['#26394f', '#6fa8dc', '#e6f0fa'], // overcast
];

export type ArtKind = 'condo' | 'townhouse' | 'house' | 'duplex';

export function listingArtSvg(id: string, variant: number, kind: ArtKind): string {
  const seed = hash(`${id}:${variant}`);
  const r = rng(seed);
  const [top, mid, glow] = PALETTES[hash(id) % PALETTES.length];
  const W = 640;
  const H = 400;
  const parts: string[] = [];

  parts.push(
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="0.7" stop-color="${mid}"/><stop offset="1" stop-color="${glow}"/></linearGradient>` +
      `<linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${glow}" stop-opacity="0.95"/><stop offset="1" stop-color="${mid}" stop-opacity="0.75"/></linearGradient></defs>`,
  );
  parts.push(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`);

  // mountains: North Shore silhouette
  let d = `M0 ${H * 0.62}`;
  for (let x = 0; x <= W; x += 40) d += ` L${x} ${H * 0.62 - r() * 80 - 20}`;
  d += ` L${W} ${H} L0 ${H} Z`;
  parts.push(`<path d="${d}" fill="#0b1220" opacity="0.35"/>`);

  if (variant === 1) {
    // interior: window with view, floor, sofa, lamp
    parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#161b26" opacity="0.88"/>`);
    parts.push(`<rect x="90" y="50" width="460" height="230" rx="6" fill="url(#sky)" stroke="#e9eef7" stroke-width="8"/>`);
    parts.push(`<line x1="320" y1="50" x2="320" y2="280" stroke="#e9eef7" stroke-width="6"/>`);
    parts.push(`<rect x="0" y="300" width="${W}" height="100" fill="#2a2118"/>`);
    parts.push(`<rect x="150" y="250" width="260" height="70" rx="16" fill="#5b6b86"/>`);
    parts.push(`<rect x="150" y="225" width="260" height="38" rx="14" fill="#6c7d9b"/>`);
    parts.push(`<rect x="470" y="190" width="6" height="110" fill="#c9ccd3"/><circle cx="473" cy="186" r="22" fill="${glow}" opacity="0.9"/>`);
    return wrap(parts, W, H);
  }

  if (variant === 2) {
    // street / neighbourhood: rows of buildings + trees
    parts.push(`<rect x="0" y="300" width="${W}" height="100" fill="#10161f"/>`);
    parts.push(`<rect x="0" y="338" width="${W}" height="6" fill="${glow}" opacity="0.5"/>`);
    let x = -10;
    while (x < W) {
      const w = 50 + r() * 70;
      const h = 70 + r() * 150;
      parts.push(`<rect x="${x}" y="${300 - h}" width="${w}" height="${h}" fill="#141b29" opacity="0.92"/>`);
      for (let wy = 300 - h + 12; wy < 290; wy += 20)
        for (let wx = x + 8; wx < x + w - 10; wx += 16)
          if (r() > 0.45) parts.push(`<rect x="${wx}" y="${wy}" width="7" height="10" fill="${glow}" opacity="${0.5 + r() * 0.5}"/>`);
      x += w + 6;
    }
    for (let i = 0; i < 5; i++) {
      const tx = 40 + i * 130 + r() * 30;
      parts.push(`<rect x="${tx}" y="305" width="6" height="36" fill="#2b1d12"/><circle cx="${tx + 3}" cy="296" r="${18 + r() * 8}" fill="#1f5a3f"/>`);
    }
    return wrap(parts, W, H);
  }

  // variant 0: exterior
  parts.push(`<rect x="0" y="330" width="${W}" height="70" fill="#0e1a14"/>`);
  if (kind === 'condo') {
    const floors = 14 + Math.floor(r() * 12);
    const bw = 190;
    const bx = 225;
    const fh = 11;
    const by = 330 - floors * fh;
    parts.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${floors * fh}" fill="#1a2233"/>`);
    parts.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${floors * fh}" fill="url(#gl)" opacity="0.18"/>`);
    for (let f = 0; f < floors; f++)
      for (let c = 0; c < 8; c++)
        parts.push(
          `<rect x="${bx + 10 + c * 22}" y="${by + 3 + f * fh}" width="14" height="7" fill="${r() > 0.35 ? glow : '#2c3550'}" opacity="${0.55 + r() * 0.45}"/>`,
        );
    parts.push(`<rect x="${bx - 30}" y="${330 - 70}" width="${bw + 60}" height="70" fill="#202a3f"/>`);
  } else {
    const bw = kind === 'duplex' ? 340 : kind === 'townhouse' ? 360 : 280;
    const bx = (W - bw) / 2;
    const bh = 120;
    parts.push(`<rect x="${bx}" y="${330 - bh}" width="${bw}" height="${bh}" fill="#26324a"/>`);
    parts.push(`<polygon points="${bx - 16},${330 - bh} ${bx + bw / 2},${330 - bh - 70} ${bx + bw + 16},${330 - bh}" fill="#141b29"/>`);
    const units = kind === 'house' ? 1 : kind === 'duplex' ? 2 : 3;
    const uw = bw / units;
    for (let u = 0; u < units; u++) {
      parts.push(`<rect x="${bx + u * uw + uw / 2 - 14}" y="${330 - 60}" width="28" height="60" fill="#3a2a1d"/>`);
      parts.push(`<rect x="${bx + u * uw + 16}" y="${330 - 100}" width="${uw / 2 - 38}" height="40" fill="${glow}" opacity="0.9"/>`);
      parts.push(`<rect x="${bx + u * uw + uw / 2 + 20}" y="${330 - 100}" width="${uw / 2 - 38}" height="40" fill="${glow}" opacity="0.75"/>`);
    }
    for (let i = 0; i < 3; i++) {
      const tx = 30 + i * 270 + r() * 40;
      parts.push(`<rect x="${tx}" y="290" width="7" height="50" fill="#2b1d12"/><ellipse cx="${tx + 3}" cy="278" rx="30" ry="${38 + r() * 12}" fill="#1c5a3e"/>`);
    }
  }
  return wrap(parts, W, H);
}

function wrap(parts: string[], w: number, h: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Illustrative placeholder image">` +
    parts.join('') +
    `<text x="14" y="${h - 12}" font-family="system-ui,sans-serif" font-size="13" fill="#ffffff" opacity="0.55">Illustration · demo listing</text></svg>`
  );
}
