import { Flame, Sparkles, TrendingDown, Timer } from 'lucide-react';
import type { DealFlag } from '../server/listings/types';

const META: Record<DealFlag, { label: string; short: string; icon: typeof Flame; cls: string }> = {
  new: { label: 'New', short: 'New', icon: Sparkles, cls: 'bg-cyan-400/15 text-cyan-300 border-cyan-400/30' },
  'price-drop': { label: 'Price cut', short: 'Price cut', icon: TrendingDown, cls: 'bg-amber-400/15 text-amber-300 border-amber-400/30' },
  'below-market': { label: 'Below market', short: 'Below mkt', icon: Flame, cls: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' },
  negotiable: { label: 'Room to negotiate', short: 'Negotiable', icon: Timer, cls: 'bg-violet-400/15 text-violet-300 border-violet-400/30' },
};

export function DealBadge({ flag, compact = false }: { flag: DealFlag; compact?: boolean }) {
  const m = META[flag];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${m.cls}`}>
      <Icon className="h-3 w-3" aria-hidden />
      {compact ? m.short : m.label}
    </span>
  );
}
