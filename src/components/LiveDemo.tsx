import { motion } from 'framer-motion';
import { Activity, MapPin, Bus, Cloud, AlertTriangle, TreePine, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';

interface PulseData {
  goScore: number;
  breakdown: { transit: number; weather: number; crowds: number; accessibility: number };
  transit: { stops: Array<{ name: string; delay: number; route: string }>; avgDelay: number };
  alerts: Array<{ type: string; title: string; severity: string; distance: string }>;
  weather: { condition: string; temp: number; feelsLike: number; warning: string | null };
  trails: Array<{ name: string; status: string; distance: string }>;
}

const mockLocations = [
  { name: 'Stanley Park, Vancouver', lat: 49.3017, lng: -123.1417 },
  { name: 'Central Park, Burnaby', lat: 49.2295, lng: -123.0097 },
  { name: 'Bear Creek Park, Surrey', lat: 49.1800, lng: -122.8410 },
  { name: 'Queens Park, New West', lat: 49.2395, lng: -122.9100 },
  { name: 'Lynn Canyon, N. Vancouver', lat: 49.3631, lng: -123.0377 },
];

function generateMockData(location: string): PulseData {
  const seed = location.length * 7;
  const transitScore = 50 + (seed % 45);
  const weatherScore = 60 + (seed % 35);
  const crowdScore = 40 + (seed % 50);
  const accessScore = 55 + (seed % 40);
  const goScore = Math.round(transitScore * 0.3 + weatherScore * 0.25 + crowdScore * 0.25 + accessScore * 0.2);

  return {
    goScore,
    breakdown: { transit: transitScore, weather: weatherScore, crowds: crowdScore, accessibility: accessScore },
    transit: {
      stops: [
        { name: 'Stop 54321', delay: Math.floor(Math.random() * 8), route: '99 B-Line' },
        { name: 'Stop 54322', delay: Math.floor(Math.random() * 4), route: 'SkyTrain Expo' },
        { name: 'Stop 54323', delay: Math.floor(Math.random() * 12), route: 'RapidBus R3' },
      ],
      avgDelay: Math.floor(Math.random() * 8),
    },
    alerts: [
      { type: 'construction', title: 'Road work on Hastings St', severity: 'medium', distance: '200m' },
      { type: 'event', title: 'Kitsilano Farmers Market today', severity: 'low', distance: '800m' },
      { type: 'complaint', title: 'Noise complaint cluster (weekend)', severity: 'low', distance: '400m' },
    ],
    weather: {
      condition: ['Partly Cloudy', 'Sunny', 'Overcast', 'Light Rain'][seed % 4],
      temp: 14 + (seed % 12),
      feelsLike: 12 + (seed % 14),
      warning: seed % 5 === 0 ? 'Wind advisory in effect' : null,
    },
    trails: [
      { name: 'Seawall Loop', status: 'open', distance: '1.2 km' },
      { name: 'Forest Trail', status: seed % 3 === 0 ? 'partial' : 'open', distance: '2.8 km' },
      { name: 'Beach Access', status: 'open', distance: '0.5 km' },
    ],
  };
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
        <motion.circle
          cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-xs text-slate-500">Go Score</span>
      </div>
    </div>
  );
}

export default function LiveDemo() {
  const [selectedLocation, setSelectedLocation] = useState(0);
  const [data, setData] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = (index: number) => {
    setLoading(true);
    // Simulate API latency
    setTimeout(() => {
      setData(generateMockData(mockLocations[index].name));
      setLoading(false);
      setLastRefresh(new Date());
    }, 800);
  };

  useEffect(() => {
    fetchData(selectedLocation);
  }, [selectedLocation]);

  const handleRefresh = () => {
    fetchData(selectedLocation);
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
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-emerald-400 font-medium text-sm uppercase tracking-wider">Live Demo</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">MetroPulse Dashboard</h2>
          <p className="text-xl text-slate-400 mb-8 max-w-3xl">
            Interactive simulation — select a location to see real-time Go Score and data breakdown
          </p>

          {/* Location Selector */}
          <div className="flex flex-wrap gap-2 mb-8">
            {mockLocations.map((loc, i) => (
              <button
                key={loc.name}
                onClick={() => setSelectedLocation(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  selectedLocation === i
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-slate-200'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                {loc.name}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                <span className="text-slate-400 text-sm">Fetching data from 5 sources...</span>
              </div>
            </div>
          ) : data ? (
            <div className="grid md:grid-cols-3 gap-6">
              {/* Main Score Card */}
              <div className="md:col-span-1 p-6 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col items-center">
                <ScoreRing score={data.goScore} />
                <div className="mt-4 text-center">
                  <h3 className="text-lg font-bold text-white">{mockLocations[selectedLocation].name}</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    {data.goScore >= 75 ? '🟢 Great time to go out!' : data.goScore >= 50 ? '🟡 Decent conditions' : '🔴 Consider staying in'}
                  </p>
                </div>
                <button
                  onClick={handleRefresh}
                  className="mt-4 px-4 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh Data
                </button>
                {lastRefresh && (
                  <p className="text-xs text-slate-600 mt-2">
                    Updated: {lastRefresh.toLocaleTimeString()}
                  </p>
                )}
              </div>

              {/* Score Breakdown */}
              <div className="md:col-span-2 space-y-4">
                {/* Breakdown Bars */}
                <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800">
                  <h4 className="text-sm font-bold text-white mb-4">Score Breakdown</h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Transit Reliability', value: data.breakdown.transit, icon: Bus, iconColor: 'text-emerald-400', barColor: 'bg-emerald-500' },
                      { label: 'Weather Conditions', value: data.breakdown.weather, icon: Cloud, iconColor: 'text-cyan-400', barColor: 'bg-cyan-500' },
                      { label: 'Crowd Level', value: data.breakdown.crowds, icon: AlertTriangle, iconColor: 'text-amber-400', barColor: 'bg-amber-500' },
                      { label: 'Accessibility', value: data.breakdown.accessibility, icon: TreePine, iconColor: 'text-violet-400', barColor: 'bg-violet-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3">
                        <item.icon className={`w-4 h-4 ${item.iconColor} shrink-0`} />
                        <span className="text-xs text-slate-400 w-32 shrink-0">{item.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${item.barColor}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${item.value}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                          />
                        </div>
                        <span className="text-xs text-slate-300 w-8 text-right font-mono">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Transit + Weather Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                    <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                      <Bus className="w-3.5 h-3.5 text-emerald-400" /> Transit Pulse
                    </h4>
                    <div className="space-y-2">
                      {data.transit.stops.map((stop) => (
                        <div key={stop.name} className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">{stop.route}</span>
                          <span className={`font-mono ${stop.delay > 5 ? 'text-red-400' : stop.delay > 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {stop.delay > 0 ? `+${stop.delay}min` : 'On time'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                    <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-cyan-400" /> Weather
                    </h4>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{data.weather.temp}°C</div>
                      <div className="text-xs text-slate-400">{data.weather.condition}</div>
                      <div className="text-xs text-slate-500 mt-1">Feels like {data.weather.feelsLike}°C</div>
                      {data.weather.warning && (
                        <div className="mt-2 text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                          ⚠️ {data.weather.warning}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Alerts */}
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                  <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Active Alerts
                  </h4>
                  <div className="space-y-2">
                    {data.alerts.map((alert, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-slate-800/50">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            alert.severity === 'high' ? 'bg-red-400' : alert.severity === 'medium' ? 'bg-amber-400' : 'bg-slate-400'
                          }`} />
                          <span className="text-slate-300">{alert.title}</span>
                        </div>
                        <span className="text-slate-500">{alert.distance}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trails */}
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                  <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                    <TreePine className="w-3.5 h-3.5 text-green-400" /> Nearby Trails
                  </h4>
                  <div className="space-y-2">
                    {data.trails.map((trail) => (
                      <div key={trail.name} className="flex items-center justify-between text-xs p-2 rounded bg-slate-800/50">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            trail.status === 'open' ? 'bg-emerald-400' : trail.status === 'partial' ? 'bg-amber-400' : 'bg-red-400'
                          }`} />
                          <span className="text-slate-300">{trail.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`capitalize ${
                            trail.status === 'open' ? 'text-emerald-400' : trail.status === 'partial' ? 'text-amber-400' : 'text-red-400'
                          }`}>{trail.status}</span>
                          <span className="text-slate-500">{trail.distance}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* API Response Preview */}
          {data && (
            <div className="mt-8 p-4 rounded-xl bg-slate-900 border border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">API Response Preview (JSON)</h4>
              <pre className="text-xs text-slate-400 overflow-x-auto font-mono">
                {JSON.stringify({
                  goScore: data.goScore,
                  breakdown: data.breakdown,
                  transit: { avgDelay: data.transit.avgDelay, stops: data.transit.stops.length },
                  alerts: data.alerts.length,
                  weather: { condition: data.weather.condition, temp: data.weather.temp },
                  trails: data.trails.map(t => ({ name: t.name, status: t.status })),
                  metadata: { location: mockLocations[selectedLocation].name, generatedAt: lastRefresh?.toISOString() }
                }, null, 2)}
              </pre>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
