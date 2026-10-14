export type MediaType = 'movie' | 'tv' | 'all';
export type Intensity = 'low' | 'medium' | 'high';
export type WatchEffort = 'low' | 'medium' | 'high';

export interface ParsedPreferences {
  mediaType: MediaType;
  mood: string[]; // e.g. ["tired", "relaxed", "curious"]
  genres: string[]; // e.g. ["action", "crime"]
  likedTitles: string[]; // e.g. ["The Godfather"]
  dislikedTitles: string[]; // titles to avoid
  mustInclude: string[]; // critical themes or elements
  excludeGenres: string[]; // genres to hard-filter
  excludeContent: string[]; // e.g. ["violent", "jump scares", "gore"]
  language: string | null; // e.g. "en", "ko"
  region: string | null; // e.g. "IN", "US"
  maxRuntimeMinutes: number | null; // e.g. 100
  releasePeriod: { startYear?: number; endYear?: number } | null;
  intensity: Intensity | null;
  watchEffort: WatchEffort | null;
  searchKeywords: string[]; // specific topic/plot/keyword search terms (e.g. ["money", "heist"])
  semanticThemes?: string[]; // related themes and concepts (e.g. ["wealth", "wall street", "cash"])
  isDirectSearch?: boolean;
  rawQuery?: string;
  clarificationNeeded: boolean;
  clarificationQuestion: string | null;
  detectedAmbiguity?: boolean;
}

export interface ResolvedTitle {
  id: number;
  title: string;
  mediaType: 'movie' | 'tv';
  year: number;
  overview: string;
  posterPath: string | null;
  voteAverage: number;
  voteCount: number;
  genres: string[];
}

export interface ProviderItem {
  name: string;
  logoUrl: string;
  type?: string;
}

export interface CandidateItem {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  year: number;
  overview: string;
  posterUrl: string;
  backdropUrl?: string;
  genres: string[];
  genreIds: number[];
  runtime?: number;
  episodeCount?: number;
  rating: number; // 0-10
  ratingSource: 'tmdb' | 'omdb' | 'curated';
  voteCount: number;
  popularity: number;
  language?: string;
  collectionId?: number;
  collectionName?: string;
  isMature?: boolean;
  moodTags?: string[];
  providers?: ProviderItem[];
  seedSimilaritySource?: 'recommendation' | 'similar' | 'genre' | 'direct' | 'keyword';
  keywordMatched?: boolean;
  matchedKeywords?: string[];
}

export interface ScoreBreakdown {
  keywordMatch?: number; // 0-40
  genreMatch: number; // 0-30
  titleSimilarity: number; // 0-25
  moodAndEffort: number; // 0-20
  constraints: number; // 0-10
  qualityConfidence: number; // 0-10
  diversityBonus: number; // 0-5
  totalScore: number; // 0-100 normalized
}

export interface RankedMovie extends CandidateItem {
  matchScore: number; // 0-100
  scoreBreakdown: ScoreBreakdown;
  matchReasons: string[];
  missingDataIndicators: string[];
  reason: string; // concise natural language explanation
  groupLabel?: string;
  isHiddenGem: boolean;
}

export interface ResultGroup {
  label: string;
  description: string;
  movies: RankedMovie[];
}

export interface RecommendationResponse {
  movies: RankedMovie[];
  groups?: ResultGroup[];
  clarification?: {
    question: string;
    options?: string[];
  } | null;
  parsedPreferences: ParsedPreferences;
}
