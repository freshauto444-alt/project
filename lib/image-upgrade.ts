// Shared image-URL upgrader for sources that ship low-res default presets.
//
// Bytbil photos come from BigBuy CDN (bbcdn.io). Listing pages hand out
// `rule=legacy-main` (320×213) which renders pixelated on a 600px+ card or
// in a fullscreen modal. Probed valid named presets:
//   • legacy-gallery   240×180
//   • legacy-main      320×213  ← default the page provides
//   • legacy-full      575×383  ← biggest the CDN exposes
// legacy-large/xlarge/original/hires/detail/fullsize/WxH all 404.
// legacy-full is the highest-res rule the CDN serves — ~2× linear / ~2.6×
// file size compared to legacy-main. We always swap when a known low-res
// preset appears.
export function upgradeBbcdnUrl(url: string | null | undefined): string {
  if (!url || !url.includes("bbcdn.io")) return url ?? ""
  return url.replace(/rule=legacy-(main|gallery|thumbnail)\b/i, "rule=legacy-full")
}
