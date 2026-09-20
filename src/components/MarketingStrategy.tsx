import { motion } from 'framer-motion';
import { Megaphone, Users, Target, Calendar, TrendingUp } from 'lucide-react';

const channels = [
  {
    platform: 'Reddit',
    communities: ['r/vancouver', 'r/surreybc', 'r/burnaby', 'r/newwestminster', 'r/britishcolumbia'],
    strategy: 'Post weekly "Weekend Go Score" threads showing top-rated locations. Share transit delay hacks. Engage authentically — no spam.',
    timeline: 'Week 1-2',
    effort: '30 min/week',
    icon: '🔴',
    expectedReach: '5K-15K views/post',
  },
  {
    platform: 'Facebook Groups',
    communities: ['Vancouver Foodies', 'Burnaby Community', 'Surrey Moms', 'Van Hiking Group', 'MTN (Metro Transit Nerds)'],
    strategy: 'Share "Neighborhood Vetting Reports" for people looking to move. Post real-time transit alerts during disruptions. Be helpful first.',
    timeline: 'Week 1-4',
    effort: '1 hr/week',
    icon: '🔵',
    expectedReach: '2K-8K members/group',
  },
  {
    platform: 'Local Tech Meetups',
    communities: ['VanJS', 'YVR Tech', 'Code Camp Vancouver', 'Hackathons at SFU/UBC'],
    strategy: 'Demo MetroPulse at meetups. Frame as "open data hack" — devs love this. Offer API access to attract developer users who become evangelists.',
    timeline: 'Month 1-2',
    effort: '2 hrs/event',
    icon: '💻',
    expectedReach: '50-200 per event',
  },
  {
    platform: 'Micro-Influencers',
    communities: ['@vanhikelife', '@yvrfoodie', '@surreyexplorer', 'transit TikTok creators'],
    strategy: 'Offer free Pro accounts in exchange for a story/post. Target 500-5K followers (high engagement, local audience). No paid sponsorships needed.',
    timeline: 'Month 1-3',
    effort: 'Outreach only',
    icon: '📱',
    expectedReach: '1K-5K per post',
  },
  {
    platform: 'Guerrilla / IRL',
    communities: ['Transit stops (SkyTrain)', 'University campuses', 'Community centers', 'Breweries/coffee shops'],
    strategy: 'QR code stickers at SkyTrain stations: "Is your bus actually on time? Scan to check." Stickers at trailheads: "Is this trail open? Check live status."',
    timeline: 'Month 2-3',
    effort: '$20 for stickers',
    icon: '📍',
    expectedReach: 'High viral potential',
  },
];

const growthMilestones = [
  { week: 'Week 1', target: '50 users', action: 'Launch on Reddit + 2 Facebook groups. Post "I built this" story.' },
  { week: 'Week 2', target: '200 users', action: 'First "Weekend Go Score" viral post. Transit alert during disruption.' },
  { week: 'Week 4', target: '500 users', action: 'Tech meetup demo. 3 micro-influencer posts. QR codes at 5 SkyTrain stations.' },
  { week: 'Week 8', target: '1,000 users', action: 'Word-of-mouth kicks in. "Neighborhood Report" shared in moving groups. Local news pitch.' },
  { week: 'Week 12', target: '2,500 users', action: 'API access attracts devs. Press coverage in Daily Hive or Narwhal. Referral program launch.' },
];

export default function MarketingStrategy() {
  return (
    <section className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-pink-400" />
            </div>
            <span className="text-pink-400 font-medium text-sm uppercase tracking-wider">Section 5</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">Local Marketing & Growth</h2>
          <p className="text-xl text-slate-400 mb-12 max-w-3xl">
            Zero paid ads. 100% grassroots. Boots-on-the-ground strategy for the Lower Mainland.
          </p>

          {/* Core Principle */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-pink-950/20 to-slate-900 border border-pink-800/20 mb-12">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Target className="w-5 h-5 text-pink-400" />
              Core Principle: "Be Useful, Not Salesy"
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Vancouverites are <em className="text-pink-300">extremely</em> allergic to marketing. The strategy is simple: 
              show up in communities where people already complain about transit delays, trail closures, or neighborhood noise — 
              and provide <strong className="text-white">genuinely useful real-time information</strong>. The product sells itself 
              when someone posts "OMG this app told me the 99 B-Line was delayed so I took the SkyTrain instead."
            </p>
          </div>

          {/* Channel Cards */}
          <div className="space-y-4 mb-12">
            {channels.map((channel, i) => (
              <motion.div
                key={channel.platform}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{channel.icon}</span>
                      <h4 className="font-bold text-white">{channel.platform}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                        {channel.timeline}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed mb-3">{channel.strategy}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {channel.communities.map((c) => (
                        <span key={c} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="md:w-40 shrink-0 space-y-2">
                    <div>
                      <div className="text-xs text-slate-600">Effort</div>
                      <div className="text-xs text-slate-300">{channel.effort}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600">Expected Reach</div>
                      <div className="text-xs text-emerald-400">{channel.expectedReach}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Growth Timeline */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
              Growth Milestones: 0 → 1,000 Users
            </h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-emerald-500 via-cyan-500 to-violet-500" />
              <div className="space-y-6">
                {growthMilestones.map((milestone, i) => (
                  <motion.div
                    key={milestone.week}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-4 pl-2"
                  >
                    <div className="w-5 h-5 rounded-full bg-slate-900 border-2 border-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                    <div className="flex-1 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-bold text-white">{milestone.week}</span>
                        <span className="text-sm font-bold text-emerald-400">{milestone.target}</span>
                      </div>
                      <p className="text-sm text-slate-400">{milestone.action}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Viral Hooks */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              Viral Moment Opportunities (Lower Mainland Specific)
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  trigger: '🌨️ First snowfall',
                  action: 'Push notification: "Roads icy + transit delayed? Check your Go Score before heading out"',
                  timing: 'Nov-March',
                },
                {
                  trigger: '🚧 Broadway Subway construction',
                  action: 'Real-time construction impact scores for affected neighborhoods. Share in r/vancouver weekly.',
                  timing: 'Ongoing (2025-2026)',
                },
                {
                  trigger: '🌊 Atmospheric river event',
                  action: 'Flood risk + trail closure overlay. Be THE source for "is it safe to go out?"',
                  timing: 'Oct-Dec',
                },
                {
                  trigger: '🚌 TransLink fare increase / service cuts',
                  action: 'Data-driven posts showing real impact on commute times. Media pickup guaranteed.',
                  timing: 'Whenever announced',
                },
              ].map((item) => (
                <div key={item.trigger} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="font-medium text-white text-sm mb-1">{item.trigger}</div>
                  <p className="text-xs text-slate-400 mb-2">{item.action}</p>
                  <span className="text-xs text-amber-400">{item.timing}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Budget Summary */}
          <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-emerald-950/30 to-cyan-950/30 border border-emerald-800/20">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Total Marketing Budget</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-emerald-400">$20</div>
                <div className="text-xs text-slate-500">QR stickers</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-400">$0</div>
                <div className="text-xs text-slate-500">Digital ads</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-400">~5 hrs</div>
                <div className="text-xs text-slate-500">Weekly time</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
