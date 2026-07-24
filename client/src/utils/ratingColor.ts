export function ratingTextClass(r: number | null | undefined) {
  const v = Number(r || 0);
  if (v > 3) return "text-emerald-700";
  if (v === 3) return "text-amber-700";
  return "text-red-700";
}

export function ratingBadgeBg(r: number | null | undefined) {
  const v = Number(r || 0);
  if (v > 3) return "bg-emerald-100";
  if (v === 3) return "bg-amber-100";
  return "bg-red-100";
}

export function ratingBadgeText(r: number | null | undefined) {
  const v = Number(r || 0);
  if (v > 3) return "text-emerald-800";
  if (v === 3) return "text-amber-800";
  return "text-red-800";
}

export function ratingBarClass(r: number | null | undefined) {
  const v = Number(r || 0);
  if (v > 3) return "bg-emerald-500";
  if (v === 3) return "bg-amber-500";
  return "bg-red-500";
}

