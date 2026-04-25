export type AvatarOption = {
  key: string
  label: string
  chip: string
  className: string
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { key: 'spark-mic', label: 'Spark Mic', chip: 'SM', className: 'bg-fuchsia-500/30 text-fuchsia-100' },
  { key: 'neon-star', label: 'Neon Star', chip: 'NS', className: 'bg-cyan-500/30 text-cyan-100' },
  { key: 'rhythm-wave', label: 'Rhythm Wave', chip: 'RW', className: 'bg-lime-500/30 text-lime-100' },
  { key: 'vinyl-pop', label: 'Vinyl Pop', chip: 'VP', className: 'bg-amber-500/30 text-amber-100' },
  { key: 'karaoke-moon', label: 'Karaoke Moon', chip: 'KM', className: 'bg-indigo-500/30 text-indigo-100' },
  { key: 'retro-sun', label: 'Retro Sun', chip: 'RS', className: 'bg-orange-500/30 text-orange-100' },
  { key: 'party-bolt', label: 'Party Bolt', chip: 'PB', className: 'bg-yellow-500/30 text-yellow-100' },
  { key: 'stage-heart', label: 'Stage Heart', chip: 'SH', className: 'bg-rose-500/30 text-rose-100' },
  { key: 'pulse-diamond', label: 'Pulse Diamond', chip: 'PD', className: 'bg-emerald-500/30 text-emerald-100' },
  { key: 'echo-flame', label: 'Echo Flame', chip: 'EF', className: 'bg-red-500/30 text-red-100' }
]

/**
 * @param {string | null | undefined} key
 */
export function getAvatarOptionByKey(key: string | null | undefined): AvatarOption | null {
  if (!key) return null
  return AVATAR_OPTIONS.find((a) => a.key === key) || null
}
