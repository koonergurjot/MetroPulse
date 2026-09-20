import { motion } from 'framer-motion';
import { Layers, CheckCircle, Code2 } from 'lucide-react';

const mvpFeatures = [
  {
    id: 1,
    title: 'Go Score Dashboard',
    description: 'Real-time composite score (0-100) for any location. Combines transit reliability, weather, crowd levels, and accessibility into one actionable number.',
    priority: 'P0 — Launch',
    effort: '2 weeks',
    tech: 'React + Tailwind + Recharts',
  },
  {
    id: 2,
    title: 'Interactive Map Overlay',
    description: 'Mapbox/Leaflet map showing color-coded Go Scores across the Lower Mainland. Users can tap any location for detailed breakdown.',
    priority: 'P0 — Launch',
    effort: '1.5 weeks',
    tech: 'Mapbox GL JS + GeoJSON',
  },
  {
    id: 3,
    title: 'Transit Pulse Widget',
    description: 'Live TransLink feed showing nearest stops, real-time arrivals, and delay predictions. Color-coded by reliability (green = on time, red = delayed).',
    priority: 'P0 — Launch',
    effort: '1 week',
    tech: 'TransLink GTFS-RT + protobuf.js',
  },
  {
    id: 4,
    title: 'Neighborhood Vetting Report',
    description: 'For renters/buyers: aggregated 311 complaints, noise bylaws, building permits, and development plans within a walkable radius.',
    priority: 'P1 — Week 2',
    effort: '2 weeks',
    tech: 'Open Data APIs + spatial join',
  },
  {
    id: 5,
    title: 'Weekend Planner Feed',
    description: 'Curated list of outdoor activities ranked by today\'s Go Score. Filters by activity type, transit accessibility, and crowd level.',
    priority: 'P1 — Week 2',
    effort: '1.5 weeks',
    tech: 'BC Parks + Events APIs + scoring',
  },
];

const techStack = [
  {
    category: 'Frontend',
    items: [
      { name: 'Next.js 14 (App Router)', reason: 'SSR for SEO, API routes for backend, zero-config deploy' },
      { name: 'Tailwind CSS', reason: 'Rapid UI development, consistent design system' },
      { name: 'Mapbox GL JS', reason: 'Free tier (50K loads/mo), beautiful maps, custom layers' },
      { name: 'Recharts', reason: 'Lightweight charting for score breakdowns' },
    ],
  },
  {
    category: 'Backend / Serverless',
    items: [
      { name: 'Next.js API Routes', reason: 'Zero additional infra, runs at edge, handles concurrent fetches' },
      { name: 'Vercel Edge Functions', reason: 'Sub-50ms cold starts, global CDN, free tier (100K invocations/day)' },
      { name: 'Upstash Redis', reason: 'Cache API responses (free tier: 10K commands/day), rate limiting' },
    ],
  },
  {
    category: 'Database & Auth',
    items: [
      { name: 'Supabase (Free Tier)', reason: 'PostgreSQL + Auth + Realtime. 500MB free, perfect for user prefs' },
      { name: 'Clerk Auth', reason: 'Free tier: 10K MAU. OAuth, magic links, zero config' },
    ],
  },
  {
    category: 'Monitoring & Analytics',
    items: [
      { name: 'Vercel Analytics', reason: 'Built-in Web Vitals, free with hosting' },
      { name: 'Plausible Analytics', reason: 'Privacy-first, self-hostable, no cookie banners needed' },
    ],
  },
];

export default function FeatureList() {
  return (
    <section className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-violet-400" />
            </div>
            <span className="text-violet-400 font-medium text-sm uppercase tracking-wider">Section 3</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">MVP Features & Tech Stack</h2>
          <p className="text-xl text-slate-400 mb-12 max-w-3xl">
            5 essential features to launch in 4 weeks. Zero operational cost on free tiers.
          </p>

          {/* MVP Features */}
          <div className="mb-16">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
              MVP Feature List
            </h3>
            <div className="space-y-4">
              {mvpFeatures.map((feature, i) => (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="w-7 h-7 rounded-full bg-violet-500/20 text-violet-400 text-sm font-bold flex items-center justify-center">
                          {feature.id}
                        </span>
                        <h4 className="font-bold text-white">{feature.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          feature.priority.includes('P0') 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {feature.priority}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm leading-relaxed ml-10">{feature.description}</p>
                    </div>
                    <div className="md:w-48 shrink-0 ml-10 md:ml-0">
                      <div className="text-xs text-slate-600 mb-1">Effort</div>
                      <div className="text-sm text-slate-300 font-medium">{feature.effort}</div>
                      <div className="text-xs text-slate-600 mt-2 mb-1">Tech</div>
                      <div className="text-xs text-cyan-400">{feature.tech}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Tech Stack */}
          <div>
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Code2 className="w-6 h-6 text-cyan-400" />
              Recommended Tech Stack
            </h3>
            <p className="text-slate-400 mb-6">
              Total monthly cost at launch: <span className="text-emerald-400 font-bold">$0.00</span> (all free tiers)
              <br />
              Scales to ~$50/mo at 10K users before needing optimization.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {techStack.map((category) => (
                <div key={category.category} className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
                  <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider text-slate-300">
                    {category.category}
                  </h4>
                  <div className="space-y-3">
                    {category.items.map((item) => (
                      <div key={item.name} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-white">{item.name}</div>
                          <div className="text-xs text-slate-500">{item.reason}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
