import { motion } from 'framer-motion';
import { Target, DollarSign, Users, Clock, Map, AlertTriangle } from 'lucide-react';

export default function BusinessIdea() {
  return (
    <section className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-amber-400 font-medium text-sm uppercase tracking-wider">Section 1</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">The Business Idea</h2>
          <p className="text-xl text-slate-400 mb-12 max-w-3xl">
            Solving the "Should I Go Out?" Problem for 2.8M Lower Mainland Residents
          </p>

          {/* Core Concept */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">🎯</span> The Friction Point
              </h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                Every weekend, Metro Vancouver residents face the same decision paralysis: 
                <em className="text-emerald-400"> "Should I go to that trail? Will the bus be on time? 
                Is the park going to be packed? Is there construction noise nearby?"</em>
              </p>
              <p className="text-slate-400 leading-relaxed">
                Currently, answering this requires checking 5-7 different websites/apps. 
                MetroPulse aggregates all signals into one real-time "Go Score" for any location.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">💡</span> The Solution: "Go Score"
              </h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                A real-time composite score (0-100) for any location in Metro Vancouver that answers:
              </p>
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>Is transit reliable right now? (TransLink GTFS-RT delays)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Map className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                  <span>Are trails/parks open & accessible? (BC Parks API)</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <span>Any active complaints/construction nearby? (311 data)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                  <span>What's the crowd level? (Building permits + event data)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Monetization */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-950/30 to-slate-900 border border-emerald-800/30 mb-12">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Monetization Strategy
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  tier: 'Free',
                  price: '$0/mo',
                  features: ['Go Score for 3 locations/day', 'Basic transit overlay', 'Community reviews'],
                  color: 'slate'
                },
                {
                  tier: 'Pro',
                  price: '$4.99/mo',
                  features: ['Unlimited Go Scores', 'Real-time push alerts', 'Neighborhood vetting reports', 'Offline trail maps'],
                  color: 'emerald',
                  popular: true
                },
                {
                  tier: 'Business',
                  price: '$29/mo',
                  features: ['API access for developers', 'White-label embeds', 'Commercial property insights', 'Priority data refresh'],
                  color: 'violet'
                }
              ].map((plan) => (
                <div key={plan.tier} className={`p-4 rounded-xl ${plan.popular ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-800/50 border border-slate-700/50'}`}>
                  {plan.popular && <span className="text-xs text-emerald-400 font-medium mb-2 block">MOST POPULAR</span>}
                  <div className="text-lg font-bold text-white">{plan.tier}</div>
                  <div className="text-2xl font-bold text-white mb-3">{plan.price}</div>
                  <ul className="space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f} className="text-sm text-slate-400 flex items-center gap-1.5">
                        <span className="text-emerald-400">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Target Audience */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
            <h3 className="text-xl font-bold text-white mb-4">🎯 Target Audience Segments</h3>
            <div className="grid md:grid-cols-4 gap-4">
              {[
                { emoji: '🏃', title: 'Weekend Warriors', desc: 'Hikers, cyclists, outdoor enthusiasts planning day trips' },
                { emoji: '🏠', title: 'Renters & Buyers', desc: 'People vetting neighborhoods before signing leases' },
                { emoji: '🚌', title: 'Daily Commuters', desc: 'Transit-dependent workers optimizing their routes' },
                { emoji: '🎉', title: 'Social Planners', desc: 'Groups looking for low-friction outing ideas' },
              ].map((seg) => (
                <div key={seg.title} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="text-2xl mb-2">{seg.emoji}</div>
                  <div className="font-medium text-white text-sm mb-1">{seg.title}</div>
                  <div className="text-xs text-slate-500">{seg.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
