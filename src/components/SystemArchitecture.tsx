import { motion } from 'framer-motion';
import { Server, Copy, Check } from 'lucide-react';
import { useState } from 'react';

const codeSnippet = `// app/api/pulse/route.ts — Next.js API Route
// Concurrent data fetcher: merges TransLink + Vancouver Open Data + BC Parks

import { NextRequest, NextResponse } from 'next/server';
import { geocode } from '@/lib/geocoder';
import { getTransitData } from '@/lib/translink';
import { get311Data } from '@/lib/vancouver-opendata';
import { getTrailStatus } from '@/lib/bcparks';
import { getWeather } from '@/lib/weather';
import { redis } from '@/lib/upstash';

export const runtime = 'edge'; // Run at the edge for low latency

interface PulseResponse {
  goScore: number;
  breakdown: {
    transit: number;
    weather: number;
    crowds: number;
    accessibility: number;
  };
  transit: {
    nearestStops: Array<{
      name: string;
      routes: string[];
      nextArrivals: Array<{ route: string; minutes: number; delay: number }>;
    }>;
    overallDelay: number;
  };
  alerts: Array<{
    type: 'construction' | 'complaint' | 'closure' | 'event';
    title: string;
    distance: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  weather: {
    condition: string;
    temp: number;
    feelsLike: number;
    warning: string | null;
  };
  trails: Array<{
    name: string;
    status: 'open' | 'closed' | 'partial';
    distance: string;
    lastUpdated: string;
  }>;
  metadata: {
    location: { lat: number; lng: number; address: string };
    generatedAt: string;
    cachedUntil: string;
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('q') || '2200 Central Park, Burnaby, BC';
  
  // Check cache first (5-min TTL)
  const cacheKey = \`pulse:\${address.toLowerCase()}\`;
  const cached = await redis.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    // STEP 1: Geocode the address
    const geo = await geocode(address);
    const { lat, lng, municipality } = geo;

    // STEP 2: Concurrently fetch all data sources
    const [transitData, complaints, trails, weather] = await Promise.all([
      getTransitData(lat, lng, { radius: 500 }),
      get311Data(lat, lng, { radius: 1000, municipality }),
      getTrailStatus(lat, lng, { radius: 5000 }),
      getWeather(lat, lng),
    ]);

    // STEP 3: Calculate Go Score
    const transitScore = calculateTransitScore(transitData);
    const weatherScore = calculateWeatherScore(weather);
    const crowdScore = calculateCrowdScore(complaints);
    const accessScore = calculateAccessScore(trails, complaints);
    
    const goScore = Math.round(
      transitScore * 0.30 +
      weatherScore * 0.25 +
      crowdScore * 0.25 +
      accessScore * 0.20
    );

    // STEP 4: Build response
    const response: PulseResponse = {
      goScore,
      breakdown: {
        transit: transitScore,
        weather: weatherScore,
        crowds: crowdScore,
        accessibility: accessScore,
      },
      transit: {
        nearestStops: transitData.stops.slice(0, 3).map(stop => ({
          name: stop.name,
          routes: stop.routes,
          nextArrivals: stop.arrivals.slice(0, 3),
        })),
        overallDelay: transitData.averageDelay,
      },
      alerts: buildAlerts(complaints, trails),
      weather: {
        condition: weather.condition,
        temp: weather.temp,
        feelsLike: weather.feelsLike,
        warning: weather.warning,
      },
      trails: trails.map(t => ({
        name: t.name,
        status: t.status,
        distance: t.distance,
        lastUpdated: t.lastUpdated,
      })),
      metadata: {
        location: { lat, lng, address: geo.formatted },
        generatedAt: new Date().toISOString(),
        cachedUntil: new Date(Date.now() + 300000).toISOString(),
      },
    };

    // Cache for 5 minutes
    await redis.set(cacheKey, response, { ex: 300 });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Pulse API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate pulse data' },
      { status: 500 }
    );
  }
}

// --- Scoring Functions ---

function calculateTransitScore(data: TransitData): number {
  if (!data.stops.length) return 30; // No transit = bad score
  const avgDelay = data.averageDelay;
  if (avgDelay <= 2) return 95;
  if (avgDelay <= 5) return 80;
  if (avgDelay <= 10) return 60;
  return 40;
}

function calculateWeatherScore(weather: WeatherData): number {
  if (weather.warning) return 30;
  if (weather.temp >= 15 && weather.temp <= 28 && !weather.rain) return 95;
  if (weather.temp >= 10 && weather.temp <= 32) return 75;
  if (weather.rain) return 50;
  return 60;
}

function calculateCrowdScore(complaints: ComplaintData[]): number {
  // More active complaints = potentially more crowded/disruptive
  const count = complaints.length;
  if (count === 0) return 90;
  if (count <= 3) return 75;
  if (count <= 8) return 55;
  return 35;
}

function calculateAccessScore(trails: TrailData[], complaints: ComplaintData[]): number {
  const openTrails = trails.filter(t => t.status === 'open').length;
  const constructionNearby = complaints.filter(c => c.type === 'construction').length;
  return Math.min(100, (openTrails * 20) + (80 - constructionNearby * 10));
}

function buildAlerts(complaints: ComplaintData[], trails: TrailData[]): Alert[] {
  const alerts: Alert[] = [];
  
  // Add trail closures
  trails.filter(t => t.status === 'closed').forEach(t => {
    alerts.push({
      type: 'closure',
      title: \`\${t.name} is currently closed\`,
      distance: t.distance,
      severity: 'high',
    });
  });

  // Add high-severity complaints
  complaints.filter(c => c.severity === 'high').slice(0, 3).forEach(c => {
    alerts.push({
      type: c.type,
      title: c.title,
      distance: c.distance,
      severity: 'high',
    });
  });

  return alerts.slice(0, 5);
}`;

export default function SystemArchitecture() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Server className="w-5 h-5 text-rose-400" />
            </div>
            <span className="text-rose-400 font-medium text-sm uppercase tracking-wider">Section 4</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">System Architecture & Code</h2>
          <p className="text-xl text-slate-400 mb-12 max-w-3xl">
            Production-ready backend service that concurrently fetches from 2+ regional sources
          </p>

          {/* Architecture Diagram */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 mb-12">
            <h3 className="text-lg font-bold text-white mb-6">🏗️ System Architecture Overview</h3>
            
            <div className="grid md:grid-cols-3 gap-6">
              {/* Client Layer */}
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <h4 className="font-bold text-emerald-400 text-sm mb-3">🖥️ Client Layer</h4>
                <ul className="space-y-2 text-xs text-slate-400">
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Next.js 14 (App Router)</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> React Server Components</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Mapbox GL JS</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> SWR for data fetching</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Tailwind CSS</li>
                </ul>
              </div>

              {/* Edge Layer */}
              <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                <h4 className="font-bold text-cyan-400 text-sm mb-3">⚡ Edge / API Layer</h4>
                <ul className="space-y-2 text-xs text-slate-400">
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Vercel Edge Functions</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Next.js API Routes</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Promise.all (concurrent)</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Upstash Redis (cache)</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Score calculation engine</li>
                </ul>
              </div>

              {/* Data Layer */}
              <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/20">
                <h4 className="font-bold text-violet-400 text-sm mb-3">📡 External Data Sources</h4>
                <ul className="space-y-2 text-xs text-slate-400">
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> TransLink GTFS-RT</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> BC Geocoder API</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Vancouver Open Data</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> BC Parks API</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Environment Canada</li>
                </ul>
              </div>
            </div>

            {/* Flow arrows */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
              <span className="px-3 py-1 rounded bg-emerald-500/10 text-emerald-400">Client</span>
              <span>→</span>
              <span className="px-3 py-1 rounded bg-cyan-500/10 text-cyan-400">Edge API</span>
              <span>→</span>
              <span className="px-3 py-1 rounded bg-violet-500/10 text-violet-400">Data Sources</span>
              <span>→</span>
              <span className="px-3 py-1 rounded bg-amber-500/10 text-amber-400">Score Engine</span>
              <span>→</span>
              <span className="px-3 py-1 rounded bg-emerald-500/10 text-emerald-400">JSON Response</span>
            </div>
          </div>

          {/* Code Snippet */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                <span className="ml-2 text-xs text-slate-400 font-mono">app/api/pulse/route.ts</span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded bg-slate-700/50"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto">
              <pre className="text-xs leading-relaxed">
                <code className="text-slate-300 font-mono whitespace-pre">
                  {codeSnippet}
                </code>
              </pre>
            </div>
          </div>

          {/* Key Design Decisions */}
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            {[
              {
                title: 'Why Edge Runtime?',
                desc: 'Sub-50ms cold starts globally. Vercel\'s edge network means a user in Surrey gets the same latency as one in Richmond. Free tier: 100K invocations/day.',
              },
              {
                title: 'Why Redis Cache?',
                desc: 'Transit data changes every 30s, but our score is valid for 5 min. Upstash Redis (free tier) prevents hammering APIs and keeps response times < 100ms.',
              },
              {
                title: 'Why Promise.all?',
                desc: 'Sequential API calls would take 2-3 seconds. Concurrent fetching with Promise.all reduces total latency to the slowest single API (~400ms).',
              },
              {
                title: 'Why Weighted Scoring?',
                desc: 'Transit reliability matters most (30%) for commuters. Weather matters for outdoor plans (25%). Weights are tunable based on user feedback.',
              },
            ].map((item) => (
              <div key={item.title} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <h4 className="font-bold text-white text-sm mb-2">{item.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
