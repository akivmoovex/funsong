export type SongStatus = 'draft' | 'published' | 'disabled'
export type RightsStatus =
  | 'private_instrumental'
  | 'owned_by_app'
  | 'permission_pending'
  | 'licensed'
  | 'blocked'
export type SongDifficulty = 'easy' | 'medium' | 'hard' | 'expert'

export type Song = {
  id: string
  title: string
  movieName: string | null
  originalArtist: string | null
  composer: string | null
  lyricist: string | null
  year: number | null
  durationMs: number | null
  durationSeconds: number | null
  difficulty: SongDifficulty | null
  status: SongStatus
  rightsStatus: RightsStatus
  isDefaultSuggestion: boolean
  instrumentalAudioPath: string | null
  /** Session-only stream URL (path), never a filesystem path */
  audioFileUrl: string | null
  audioMimeType: string | null
  tags: string[]
  createdBy?: string | null
  createdAt?: string
  updatedAt?: string
}
