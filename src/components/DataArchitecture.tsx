import { motion } from 'framer-motion';
import { Network, ArrowRight, Database } from 'lucide-react';

const dataSources = [
  {
    name: 'TransLink GTFS-RT',
    color: 'emerald',
    icon: '🚌',
    endpoint: 'api.translink.ca/v2/gtfsrealtime',
    data: 'Real-time bus/train positions, delays, service alerts',
    frequency: 'Every 30 seconds',
    auth: 'API Key (free tier)',
  },
  {
    name: 'BC Address Geocoder',
    color: 'cyan',
    icon: '📍',
    endpoint: 'geocoder.api.gov.bc.ca',
    data: 'Lat/lng from any BC address, reverse geocoding',
    frequency: 'On-demand',
    auth: 'API Key (free, 10K/day)',
  },
  {
    name: 'City of Vancouver Open Data',
    color: 'violet',
    icon: '🏙️',
    endpoint: 'opendata.vancouver.ca',
    data: '311 complaints, building permits, noise bylaws, events',
    frequency: 'Hourly refresh',
    auth: 'None (public)',
  },
  {
    name: 'Surrey Open Data',
    color: 'amber',
    icon: '🏗️',
    endpoint: 'data.surrey.ca',
    data: 'Building permits, development applications, parks',
    frequency: 'Daily',
    auth: 'None (public)',
  },
  {
    name: 'BC Parks API',
    color: 'green',
    icon: '🌲',
    endpoint: 'bcparks.ca/api',
    data: 'Trail conditions, campground availability, closures',
    frequency: 'Every 15 min',
    auth: 'None (public)',
  },
  {
    name: 'New West Open Data',
    color: 'rose',
    icon: '📊',
    endpoint: 'data.newwestcity.ca',
    data: 'Community events, facility bookings, inspections',
    frequency: 'Daily',
    auth: 'None (public)',
  },
  {
    name: 'Environment Canada',
    color: 'blue',
    icon: '🌤️',
    endpoint: 'api.weather.gc.ca',
    data: 'Current conditions, forecasts, weather warnings',
    frequency: 'Every 5 min',
    auth: 'None (public)',
  },
];

export default function DataArchitecture() {
  return (
    <section className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Network className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-cyan-400 font-medium text-sm uppercase tracking-wider">Section 2</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">The "Banded" Data Architecture</h2>
          <p className="text-xl text-slate-400 mb-12 max-w-3xl">
            How 7+ free public APIs are orchestrated into a single, unified data engine
          </p>

          {/* Flow Diagram */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 mb-12">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-400" />
              Data Flow: User Request → Unified Response
            </h3>
            
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0 text-right">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Step 1</span>
                  <p className="text-sm text-white font-medium">User Input</p>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-sm text-emerald-300">
                    User enters address: "2200 Central Park, Burnaby" or drops a pin on map
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 pl-36">
                <ArrowRight className="w-4 h-4 text-slate-600 rotate-90" />
              </div>

              {/* Step 2 */}
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0 text-right">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Step 2</span>
                  <p className="text-sm text-white font-medium">Geocode</p>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <p className="text-sm text-cyan-300">
                    BC Geocoder → <code className="text-cyan-200 bg-cyan-900/30 px-1 rounded">49.2295, -123.0097</code> + determines municipality (Burnaby)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 pl-36">
                <ArrowRight className="w-4 h-4 text-slate-600 rotate-90" />
              </div>

              {/* Step 3 */}
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0 text-right">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Step 3</span>
                  <p className="text-sm text-white font-medium">Parallel Fetch</p>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <p className="text-sm text-violet-300 mb-2">Concurrent API calls (Promise.all):</p>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">🚌 TransLink: nearest stops + delays</span>
                    <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">🏙️ Van Open Data: 311 within 500m</span>
                    <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">🌲 BC Parks: trail status within 2km</span>
                    <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">🌤️ Weather: current conditions</span>
                    <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">🏗️ Permits: active construction</span>
                    <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">📊 Events: nearby activities</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pl-36">
                <ArrowRight className="w-4 h-4 text-slate-600 rotate-90" />
              </div>

              {/* Step 4 */}
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0 text-right">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Step 4</span>
                  <p className="text-sm text-white font-medium">Score Engine</p>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm text-amber-300">
                    Weighted algorithm combines all signals → <strong className="text-white">Go Score: 78/100</strong>
                    <br /><span className="text-slate-400">(Transit: 85, Weather: 92, Crowds: 65, Accessibility: 70)</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 pl-36">
                <ArrowRight className="w-4 h-4 text-slate-600 rotate-90" />
              </div>

              {/* Step 5 */}
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0 text-right">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Step 5</span>
                  <p className="text-sm text-white font-medium">Response</p>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-sm text-emerald-300">
                    Clean JSON → Frontend renders map, score card, transit widget, alerts
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* API Source Cards */}
          <h3 className="text-xl font-bold text-white mb-6">📡 All Data Sources</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dataSources.map((source, i) => (
              <motion.div
                key={source.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{source.icon}</span>
                  <h4 className="font-semibold text-white text-sm">{source.name}</h4>
                </div>
                <p className="text-xs text-slate-400 mb-3">{source.data}</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 w-16">Endpoint:</span>
                    <code className="text-xs text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded truncate">{source.endpoint}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 w-16">Refresh:</span>
                    <span className="text-xs text-slate-400">{source.frequency}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 w-16">Auth:</span>
                    <span className="text-xs text-emerald-400">{source.auth}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
