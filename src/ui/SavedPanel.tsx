import { Heart } from 'lucide-react';
import type { Listing } from '../server/listings/types';
import type { SavedEntry } from '../lib/useSaved';
import ListingCard from './ListingCard';

export default function SavedPanel({ listings, entries, ids, loading, activeId, onSelect, onHover, onToggle, onNote }: {
  listings: Listing[];
  entries: Record<string, SavedEntry>;
  ids: string[];
  loading: boolean;
  activeId: string | null;
  onSelect: (l: Listing) => void;
  onHover: (id: string | null) => void;
  onToggle: (id: string) => void;
  onNote: (id: string, n: string) => void;
}) {
  if (ids.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <Heart className="mx-auto h-8 w-8 text-slate-600" aria-hidden />
        <p className="mt-3 text-[14px] font-medium text-slate-200">No saved homes yet</p>
        <p className="mt-1 text-[12px] text-slate-500">Tap the heart on any listing. Saves and notes stay in this browser; nothing is uploaded.</p>
      </div>
    );
  }
  const gone = ids.filter((id) => !listings.some((l) => l.id === id));
  return (
    <div className="space-y-3 p-4">
      {loading && <div className="shimmer h-24 rounded-2xl" />}
      {listings.map((l) => (
        <div key={l.id} className="space-y-1.5">
          <ListingCard listing={l} active={l.id === activeId} onSelect={() => onSelect(l)} onHover={onHover} saved onToggleSave={() => onToggle(l.id)} />
          <input value={entries[l.id]?.note ?? ''} onChange={(e) => onNote(l.id, e.target.value)} maxLength={500} aria-label={`Note for ${l.address}`} placeholder="Add a note…" className="w-full rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600" />
        </div>
      ))}
      {!loading && gone.length > 0 && (
        <div className="rounded-xl border border-white/10 p-3 text-[12px] text-slate-400">
          {gone.length} saved home{gone.length > 1 ? 's are' : ' is'} no longer listed (sold, withdrawn, or the demo data changed).
          <button type="button" onClick={() => gone.forEach(onToggle)} className="ml-2 text-emerald-300 hover:underline">Clear</button>
        </div>
      )}
    </div>
  );
}
