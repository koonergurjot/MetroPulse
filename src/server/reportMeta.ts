/**
 * OpenGraph/Twitter card copy for a `/report/<slug>` page.
 *
 * Kept separate from the HTMLRewriter wiring in `worker.ts` (a Workers-only
 * global vitest can't exercise) so the copy itself — title, description,
 * which components get bragged about — stays a plain, testable function.
 */
import { buildPulse } from './pulse.ts';
import { strongestComponents } from './og.ts';
import type { PulseResponse } from './types.ts';

export interface ReportMeta {
  title: string;
  description: string;
  /** Canonical slug for this report; may differ from the URL's slug if the caller typed a variant spelling. */
  slug: string;
  /** Path form, e.g. `/report/555-w-hastings-st-vancouver`. */
  canonicalPath: string;
}

const SITE_NAME = 'MetroPulse';
const GENERIC_DESCRIPTION = 'Live transit, permits and civic data for Metro Vancouver.';

export function buildReportMetaFromPulse(pulse: PulseResponse): ReportMeta {
  const address = pulse.location.address ?? `${pulse.location.lat.toFixed(5)}, ${pulse.location.lng.toFixed(5)}`;
  const slug = pulse.location.slug ?? '';
  const scoreText = pulse.score.value === null ? 'Pulse Score unavailable' : `Pulse Score ${pulse.score.value}/100`;
  const highlights = strongestComponents(pulse.score.components, 2)
    .map((c) => `${c.label} ${c.score}`)
    .join(' · ');

  return {
    title: `${address} — ${SITE_NAME}`,
    description: highlights ? `${scoreText} — ${highlights}. ${GENERIC_DESCRIPTION}` : `${scoreText}. ${GENERIC_DESCRIPTION}`,
    slug,
    canonicalPath: slug ? `/report/${slug}` : '/',
  };
}

/** Generic fallback meta for a slug that fails to resolve (bad address, upstream down). */
export function fallbackReportMeta(slug: string): ReportMeta {
  return {
    title: `${SITE_NAME} — Metro Vancouver address report`,
    description: GENERIC_DESCRIPTION,
    slug,
    canonicalPath: `/report/${slug}`,
  };
}

export interface ReportMetaResult {
  meta: ReportMeta;
  /** True when the pulse behind this meta failed to build or came back degraded — callers should shorten caching. */
  degraded: boolean;
}

export async function resolveReportMeta(slug: string, signal?: AbortSignal): Promise<ReportMetaResult> {
  try {
    const pulse = await buildPulse({ slug }, signal);
    const degraded = pulse.sources.some((s) => s.status === 'error');
    return { meta: buildReportMetaFromPulse(pulse), degraded };
  } catch {
    return { meta: fallbackReportMeta(slug), degraded: true };
  }
}
