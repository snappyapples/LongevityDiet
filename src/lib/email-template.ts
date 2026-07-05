/**
 * Email-safe HTML renderer for the daily digest. Table-based layout + inline
 * styles (Gmail strips <style> and SVG, so everything is inlined and we avoid
 * SVG). Brand palette mirrors src/app/icon.svg (nutrition-green tree-rings).
 */
import type { DigestSectionView, DigestView, NewIdea } from './email-digest'
import type { RankedCandidate } from './meal-history'

// Brand palette (from icon.svg)
const C = {
  green: '#4CAF50',
  greenDark: '#1B5E20',
  greenMid: '#2E7D32',
  greenSoft: '#C5E1A5',
  text: '#1f2937',
  muted: '#6b7280',
  bg: '#f3f4f6',
  card: '#ffffff',
  border: '#e5e7eb',
  amber: '#b45309',
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function gainMeta(c: RankedCandidate): string {
  const parts: string[] = []
  if (c.projectedGain > 0) parts.push(`+${c.projectedGain.toFixed(1)} longevity pts`)
  if (c.proteinGain > 0) parts.push(`${c.proteinGain}g protein`)
  return parts.join(' · ')
}

function candidateCard(c: RankedCandidate): string {
  const meta = gainMeta(c)
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      <tr>
        <td style="background:${C.card};border:1px solid ${C.border};border-left:3px solid ${C.green};border-radius:6px;padding:10px 12px;">
          <div style="font-size:15px;font-weight:600;color:${C.text};line-height:1.3;">${esc(c.label)}</div>
          ${meta ? `<div style="font-size:12px;color:${C.greenMid};margin-top:3px;">${esc(meta)}</div>` : ''}
        </td>
      </tr>
    </table>`
}

function newCard(idea: NewIdea): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      <tr>
        <td style="background:${C.card};border:1px solid ${C.border};border-left:3px solid ${C.greenSoft};border-radius:6px;padding:10px 12px;">
          <div style="font-size:15px;font-weight:600;color:${C.text};line-height:1.3;">${esc(idea.label)}</div>
          <div style="font-size:12px;color:${C.muted};margin-top:3px;line-height:1.4;">${esc(idea.why)}</div>
        </td>
      </tr>
    </table>`
}

function subBlock(label: string, body: string): string {
  if (!body) return ''
  return `
    <div style="margin:0 0 14px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};margin:0 0 6px;">${esc(label)}</div>
      ${body}
    </div>`
}

function sectionBlock(s: DigestSectionView): string {
  const fav = s.favorites.map(candidateCard).join('')
  const rec = s.recent.map(candidateCard).join('')
  const fresh = s.fresh.map(newCard).join('')

  const inner =
    subBlock('Old favorites', fav) + subBlock('Recent cravings', rec) + subBlock('Something new', fresh)

  const body =
    inner.trim() ||
    `<div style="font-size:13px;color:${C.muted};font-style:italic;">Log a few ${esc(
      s.heading.toLowerCase(),
    )}s and your favorites will start showing up here.</div>`

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      <tr><td style="padding:18px 0 4px;">
        <div style="font-size:18px;font-weight:700;color:${C.greenDark};border-bottom:2px solid ${C.greenSoft};padding-bottom:6px;margin-bottom:14px;">${esc(s.heading)}</div>
        ${body}
      </td></tr>
    </table>`
}

function proteinBar(current: number, target: number): string {
  if (!target) {
    return `<div style="font-size:13px;color:${C.muted};">Set your weight in the app to track a protein target.</div>`
  }
  const pct = Math.max(0, Math.min(100, Math.round((current / target) * 100)))
  const remaining = Math.max(0, target - current)
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">
      <tr>
        <td style="font-size:13px;color:${C.text};padding-bottom:4px;">
          <strong>${current}g</strong> of ${target}g protein${remaining > 0 ? ` · ${remaining}g to go today` : ' · target met 🎉'}
        </td>
      </tr>
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.border};border-radius:99px;height:8px;">
          <tr><td style="width:${pct}%;background:${C.green};border-radius:99px;height:8px;font-size:0;line-height:0;">&nbsp;</td><td style="font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td></tr>
    </table>`
}

function gapChips(view: DigestView): string {
  if (!view.rollingHasData || view.topGaps.length === 0) {
    return `<div style="font-size:13px;color:${C.muted};">Log meals this week and your biggest gaps will show here.</div>`
  }
  const chips = view.topGaps
    .map((g) => {
      const color = g.kind === 'avoid' ? C.amber : C.greenMid
      const verb = g.kind === 'avoid' ? 'cut back' : '+' + g.gapPoints.toFixed(1) + ' pts'
      return `<span style="display:inline-block;background:#f0f7ed;border:1px solid ${C.greenSoft};color:${color};font-size:12px;font-weight:600;border-radius:99px;padding:4px 10px;margin:0 6px 6px 0;">${esc(
        g.label,
      )} · ${esc(verb)}</span>`
    })
    .join('')
  return `<div style="margin-top:4px;">${chips}</div>`
}

export function renderDigestEmail(view: DigestView): string {
  const deltaStr =
    view.weeklyDelta == null
      ? ''
      : view.weeklyDelta >= 0
        ? `▲ ${view.weeklyDelta.toFixed(1)} vs last week`
        : `▼ ${Math.abs(view.weeklyDelta).toFixed(1)} vs last week`
  const deltaColor = (view.weeklyDelta ?? 0) >= 0 ? C.greenMid : C.amber

  const sections = view.sections.map(sectionBlock).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Longevity Diet</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:20px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:${C.card};border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

        <!-- Header -->
        <tr><td style="background:${C.greenDark};padding:22px 28px;">
          <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">Longevity Diet</div>
          <div style="font-size:13px;color:${C.greenSoft};margin-top:2px;">${esc(view.greeting)} · ${esc(view.dateLabel)}</div>
        </td></tr>

        <!-- Status card -->
        <tr><td style="padding:24px 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};">7-day longevity score</div>
                <div style="font-size:40px;font-weight:800;color:${C.greenDark};line-height:1.1;">${view.rollingHasData ? view.rollingScore : '—'}<span style="font-size:18px;font-weight:600;color:${C.muted};">/100</span></div>
                ${deltaStr ? `<div style="font-size:12px;font-weight:600;color:${deltaColor};">${esc(deltaStr)}</div>` : ''}
              </td>
            </tr>
          </table>

          <div style="margin-top:16px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};">Biggest gaps right now</div>
          ${gapChips(view)}

          <div style="margin-top:16px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};">Protein today</div>
          ${proteinBar(view.proteinCurrent, view.proteinTarget)}
        </td></tr>

        <!-- Sections -->
        <tr><td style="padding:0 28px 8px;">
          ${sections}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:18px 28px 26px;border-top:1px solid ${C.border};">
          <a href="${esc(view.appUrl)}" style="display:inline-block;background:${C.green};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:10px 20px;border-radius:8px;">Open Longevity Diet →</a>
          <div style="font-size:12px;color:${C.muted};margin-top:14px;line-height:1.5;">
            Picks are ranked by how much they'd move your current 7-day gaps. Favorites &amp; recent are from your own log; “something new” is AI, tuned to your remembered preferences.<br>
            To pause these emails, turn off the trigger in your Apps Script project.
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
