export interface Provider {
  name: string;
  logoUrl: string;
  type?: string;
}

export interface ScoreBreakdown {
  keywordMatch?: number;
  genreMatch: number;
  titleSimilarity: number;
  moodAndEffort: number;
  constraints: number;
  qualityConfidence: number;
  diversityBonus: number;
  totalScore: number;
}

export interface Movie {
  id: number;
  mediaType?: 'movie' | 'tv';
  title: string;
  year: number;
  genres: string[];
  runtime?: number;
  rating: number;
  overview: string;
  posterUrl: string;
  providers?: Provider[];
  reason: string;
  matchScore?: number;
  scoreBreakdown?: ScoreBreakdown;
  matchReasons?: string[];
  missingDataIndicators?: string[];
  isHiddenGem?: boolean;
}

export interface ResultGroup {
  label: string;
  description: string;
  movies: Movie[];
}

export interface ClarificationInfo {
  question: string;
  options?: string[];
}

export interface Preferences {
  highlyRated: boolean;
  hiddenGems: boolean;
  recent: boolean;
  classics: boolean;
  mature: boolean;
}

export interface WizardState {
  step: number; // 0 = Hero, 1..7 = Questions, 8 = Results
  naturalQuery: string; // Natural-language prompt
  mood: string;
  genres: string[];
  audience: string;
  maxRuntime: string;
  languages: string[];
  preferences: Preferences;
  note: string;
}

export interface UserFeedback {
  savedMovies: Movie[];
  notInterestedIds: number[];
  watchedIds: number[];
  likedTitles: string[];
  dislikedTitles: string[];
}
