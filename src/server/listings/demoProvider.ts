/**
 * Deterministic demo provider: synthetic listings anchored on real Lower
 * Mainland neighbourhoods so the map, filters and deal engine have something
 * realistic to render. Nothing here describes a real property: addresses are
 * intersection hints, prices are generated, and photos are drawn illustrations.
 *
 * Swap this for a licensed provider (see types.ts) by changing `getProvider`.
 */
import { listingArtSvg } from './art.ts';
import type { ListingProvider, ListingQuery, PropertyType, RawListing } from './types.ts';

interface Anchor {
  neighbourhood: string;
  municipality: string;
  lat: number;
  lng: number;
  hint: string;
  /** Typical condo sale $/sqft, in CAD. Rough orders of magnitude only. */
  ppsf: number;
  /** Radius (m) over which demo listings scatter around the anchor. */
  spread: number;
  houses: boolean;
}

const ANCHORS: Anchor[] = [
  { neighbourhood: 'Downtown', municipality: 'Vancouver', lat: 49.2827, lng: -123.1207, hint: 'near W Georgia St & Burrard St', ppsf: 1180, spread: 900, houses: false },
  { neighbourhood: 'Yaletown', municipality: 'Vancouver', lat: 49.2745, lng: -123.1218, hint: 'near Davie St & Hamilton St', ppsf: 1240, spread: 500, houses: false },
  { neighbourhood: 'Kitsilano', municipality: 'Vancouver', lat: 49.2684, lng: -123.1555, hint: 'near W 4th Ave & Yew St', ppsf: 1320, spread: 1100, houses: true },
  { neighbourhood: 'Mount Pleasant', municipality: 'Vancouver', lat: 49.2639, lng: -123.1005, hint: 'near Main St & E 7th Ave', ppsf: 1150, spread: 900, houses: true },
  { neighbourhood: 'Hastings-Sunrise', municipality: 'Vancouver', lat: 49.2815, lng: -123.0425, hint: 'near E Hastings St & Renfrew St', ppsf: 980, spread: 900, houses: true },
  { neighbourhood: 'Metrotown', municipality: 'Burnaby', lat: 49.2276, lng: -123.0016, hint: 'near Kingsway & Willingdon Ave', ppsf: 960, spread: 800, houses: false },
  { neighbourhood: 'Brentwood', municipality: 'Burnaby', lat: 49.2664, lng: -123.0016, hint: 'near Lougheed Hwy & Willingdon Ave', ppsf: 1010, spread: 700, houses: false },
  { neighbourhood: 'Edmonds', municipality: 'Burnaby', lat: 49.2125, lng: -122.9585, hint: 'near Kingsway & Edmonds St', ppsf: 900, spread: 900, houses: true },
  { neighbourhood: 'City Centre', municipality: 'Richmond', lat: 49.1666, lng: -123.1364, hint: 'near No. 3 Rd & Cook Rd', ppsf: 930, spread: 900, houses: false },
  { neighbourhood: 'Steveston', municipality: 'Richmond', lat: 49.1259, lng: -123.1851, hint: 'near Moncton St & 3rd Ave', ppsf: 880, spread: 900, houses: true },
  { neighbourhood: 'Surrey City Centre', municipality: 'Surrey', lat: 49.1913, lng: -122.8490, hint: 'near 104 Ave & King George Blvd', ppsf: 760, spread: 900, houses: false },
  { neighbourhood: 'Newton', municipality: 'Surrey', lat: 49.1344, lng: -122.8457, hint: 'near 72 Ave & 128 St', ppsf: 640, spread: 1400, houses: true },
  { neighbourhood: 'Fleetwood', municipality: 'Surrey', lat: 49.1536, lng: -122.7991, hint: 'near Fraser Hwy & 160 St', ppsf: 690, spread: 1200, houses: true },
  { neighbourhood: 'Clayton', municipality: 'Surrey', lat: 49.1124, lng: -122.7228, hint: 'near 188 St & 72 Ave', ppsf: 650, spread: 1300, houses: true },
  { neighbourhood: 'Burquitlam', municipality: 'Coquitlam', lat: 49.2610, lng: -122.8898, hint: 'near Clarke Rd & Como Lake Ave', ppsf: 930, spread: 800, houses: true },
  { neighbourhood: 'Downtown', municipality: 'New Westminster', lat: 49.2034, lng: -122.9115, hint: 'near Columbia St & 6th St', ppsf: 880, spread: 800, houses: true },
  { neighbourhood: 'Lower Lonsdale', municipality: 'North Vancouver', lat: 49.3098, lng: -123.0818, hint: 'near Lonsdale Ave & Esplanade', ppsf: 1010, spread: 900, houses: true },
  { neighbourhood: 'Langley City', municipality: 'Langley', lat: 49.1044, lng: -122.6603, hint: 'near Fraser Hwy & 200 St', ppsf: 650, spread: 1200, houses: true },
  { neighbourhood: 'Ladner', municipality: 'Delta', lat: 49.0888, lng: -123.0825, hint: 'near Ladner Trunk Rd & 48 Ave', ppsf: 640, spread: 1000, houses: true },
];

const FEATURES: Record<PropertyType, readonly string[]> = {
  condo: ['In-suite laundry', 'Mountain view', 'Steps to SkyTrain', 'Pet friendly', 'EV charging', 'Rooftop deck', 'Gym', 'Secure parking', 'Newly renovated', 'Corner unit', 'Storage locker'],
  townhouse: ['In-suite laundry', 'Steps to SkyTrain', 'Pet friendly', 'EV charging', 'Private patio', 'Double garage', 'Newly renovated', 'Family complex'],
  house: ['Mountain view', 'Laneway home', 'South-facing yard', 'EV charging', 'Double garage', 'Newly renovated', 'Mortgage helper suite', 'Large lot'],
  duplex: ['Laneway home', 'South-facing yard', 'Separate entrances', 'Newly renovated', 'Mortgage helper suite', 'Double garage'],
};

const BROKERAGES = ['Sample Realty Group', 'Demo Pacific Homes', 'Placeholder & Co.', null];

/** mulberry32: tiny seeded PRNG, so the same bounds always return the same demo data. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, items: readonly T[]): T => items[Math.floor(r() * items.length)];

function offsetMetres(lat: number, lng: number, dxM: number, dyM: number): { lat: number; lng: number } {
  const dLat = dyM / 111_320;
  const dLng = dxM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

const round = (n: number, step: number): number => Math.round(n / step) * step;

export function generateDemoListings(): RawListing[] {
  const out: RawListing[] = [];
  ANCHORS.forEach((anchor, ai) => {
    const r = mulberry32(0x9e3779b1 ^ (ai * 7919));
    const count = 9 + Math.floor(r() * 6);
    for (let i = 0; i < count; i++) {
      const id = `demo-${ai.toString(36)}${i.toString(36)}`;
      const kind = r() < 0.28 ? 'rent' : 'sale';
      const types: PropertyType[] = anchor.houses
        ? ['condo', 'condo', 'townhouse', 'house', 'house', 'duplex']
        : ['condo', 'condo', 'condo', 'townhouse'];
      const propertyType = pick(r, types);
      const beds = propertyType === 'condo' ? 1 + Math.floor(r() * 3) : propertyType === 'townhouse' ? 2 + Math.floor(r() * 3) : 3 + Math.floor(r() * 4);
      const baths = Math.max(1, Math.min(beds, 1 + Math.floor(r() * 3)));
      const sqft = Math.round(
        (propertyType === 'condo' ? 430 + beds * 260 : propertyType === 'townhouse' ? 1050 + beds * 280 : 1500 + beds * 420) *
          (0.88 + r() * 0.26),
      );
      const typeFactor = propertyType === 'house' ? 0.88 : propertyType === 'duplex' ? 0.9 : propertyType === 'townhouse' ? 0.84 : 1;
      const quality = 0.86 + r() * 0.3; // wide enough to produce genuine "below market" outliers
      const salePpsf = anchor.ppsf * typeFactor * quality * (propertyType === 'house' ? 1.45 : 1);
      const salePrice = round(sqft * salePpsf, 5000);
      const rentPrice = round(Math.max(1500, sqft * (3.3 + (anchor.ppsf / 1000) * 0.9) * (0.9 + r() * 0.2)), 50);
      const price = kind === 'sale' ? salePrice : rentPrice;
      const daysOnMarket = Math.floor(r() ** 1.7 * 90);
      const hasDrop = kind === 'sale' && daysOnMarket > 10 && r() < 0.28;
      const dropPct = Math.round((1.5 + r() * 6) * 10) / 10;
      const featureCount = 2 + Math.floor(r() * 3);
      const features = Array.from(new Set(Array.from({ length: featureCount }, () => pick(r, FEATURES[propertyType]))));
      const angle = r() * Math.PI * 2;
      const dist = Math.sqrt(r()) * anchor.spread;
      const pos = offsetMetres(anchor.lat, anchor.lng, Math.cos(angle) * dist, Math.sin(angle) * dist);

      out.push({
        id,
        kind,
        propertyType,
        address: `Sample listing ${anchor.hint}`,
        neighbourhood: anchor.neighbourhood,
        municipality: anchor.municipality,
        lat: Math.round(pos.lat * 1e5) / 1e5,
        lng: Math.round(pos.lng * 1e5) / 1e5,
        price,
        beds,
        baths,
        sqft,
        yearBuilt: 1962 + Math.floor(r() * 62),
        daysOnMarket,
        priceDrop: hasDrop ? { fromPrice: round(price / (1 - dropPct / 100), 5000), pct: dropPct } : null,
        features,
        photos: [0, 1, 2].map((v) => `/api/art/${id}.svg?v=${v}&t=${propertyType}`),
        brokerage: pick(r, BROKERAGES),
      });
    }
  });
  return out;
}

let cache: RawListing[] | null = null;

export const demoProvider: ListingProvider = {
  info: {
    id: 'demo',
    label: 'Demo data',
    demo: true,
    notice:
      'Sample listings generated for demonstration. They are not real properties. Live listings require a licensed MLS® feed through a brokerage partner.',
  },
  async fetch(query: ListingQuery): Promise<RawListing[]> {
    cache ??= generateDemoListings();
    return cache.filter(
      (l) => l.lat >= query.south && l.lat <= query.north && l.lng >= query.west && l.lng <= query.east,
    );
  },
};

export { listingArtSvg };
