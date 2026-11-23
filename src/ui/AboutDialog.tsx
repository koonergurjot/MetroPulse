import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export default function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} className="m-auto max-h-[88vh] w-[min(640px,94vw)] overflow-hidden rounded-3xl border border-white/10 bg-[#0a101c] p-0 text-slate-200 backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <div className="scroll-y max-h-[88vh] space-y-5 p-6 text-[13px] leading-relaxed">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">About MetroPulse</h2>
            <p className="mt-1 text-slate-400">Know the block before you sign: a map-first look at Metro Vancouver neighbourhoods and homes.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <section>
          <h3 className="mb-1.5 font-semibold text-white">About the listings you see</h3>
          <p className="text-slate-300">
            Listings are <strong className="text-amber-300">demonstration data</strong>: generated sample homes, not real properties. MetroPulse does not scrape listing sites. MLS® listings and photos can only be shown through a licensed feed (CREA DDF® or a board IDX feed) operated with a BC brokerage partner. The app is built so a licensed feed plugs in without changing the interface.
          </p>
        </section>

        <section>
          <h3 className="mb-1.5 font-semibold text-white">Live neighbourhood data</h3>
          <ul className="list-disc space-y-1 pl-5 text-slate-300">
            <li>BC Address Geocoder (Open Government Licence – BC)</li>
            <li>City of Vancouver, Surrey and Burnaby open data (their Open Government Licences)</li>
            <li>DriveBC Open511 road events</li>
            <li>TransLink GTFS and GTFS-Realtime (key required; stop index must be generated)</li>
          </ul>
          <p className="mt-2 text-slate-400">Missing sources show as unavailable rather than as a reassuring zero. The Pulse Score is an experimental summary, not a guarantee.</p>
        </section>

        <section>
          <h3 className="mb-1.5 font-semibold text-white">Map and attribution</h3>
          <p className="text-slate-300">Basemap © OpenStreetMap contributors, OpenMapTiles, served by OpenFreeMap. Planned SkyTrain lines are schematic: positions are approximate and dates are government targets.</p>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-slate-400">
          The “deal” signals compare asking price per square foot with similar listings in view. They are not appraisals and not financial or legal advice.
        </section>
      </div>
    </dialog>
  );
}
