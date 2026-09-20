import { motion } from 'framer-motion';
import { ArrowRight, Zap, MapPin, TrendingUp, Activity, Network } from 'lucide-react';

interface HeroProps {
  onNavigate: (section: string) => void;
}

export default function Hero({ onNavigate }: HeroProps) {
  return (
    <section className="min-h-screen flex items-center justify-center relative pt-16">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8">
            <Zap className="w-4 h-4" />
            <span>Lower Mainland Open Data Blueprint</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              MetroPulse
            </span>
            <br />
            <span className="text-3xl md:text-4xl text-slate-400 font-normal">
              Real-Time Intelligence for Metro Vancouver
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            A unified data engine that bands together <span className="text-emerald-400 font-medium">TransLink GTFS-RT</span>, 
            <span className="text-cyan-400 font-medium"> Municipal Open Data</span>, and 
            <span className="text-violet-400 font-medium"> BC Parks APIs</span> to solve the #1 friction point 
            for locals: <em className="text-white">"Should I go out today, and how do I get there?"</em>
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <button
              onClick={() => onNavigate('idea')}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-900 font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center gap-2"
            >
              View Full Blueprint <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('demo')}
              className="px-6 py-3 bg-slate-800 border border-slate-700 text-slate-200 font-semibold rounded-xl hover:bg-slate-700 transition-all flex items-center gap-2"
            >
              <Activity className="w-4 h-4" /> Live Demo
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { label: 'Free APIs Banded', value: '7+', icon: Network },
              { label: 'Monthly Users Target', value: '1K', icon: TrendingUp },
              { label: 'Monthly OpEx', value: '$0', icon: Zap },
              { label: 'Municipalities', value: '6+', icon: MapPin },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50"
              >
                <stat.icon className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-slate-500">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
