import { FALLBACK_CATALOG, MovieItem } from './catalog.js';

export interface MoviePick {
  id: number;
  title: string;
  year: number;
  genres: string[];
  runtime: number;
  rating: number;
  overview: string;
  posterUrl: string;
  providers: { name: string; logoUrl: string; type?: string }[];
  reason: string;
  isHiddenGem: boolean;
}

export interface RecommendParams {
  mood: string;
  genres: string[];
  audience: string;
  maxRuntime: string;
  languages: string[];
  preferences: {
    highlyRated?: boolean;
    hiddenGems?: boolean;
    recent?: boolean;
    classics?: boolean;
    mature?: boolean;
  };
  note?: string;
  excludeIds?: number[];
}

export const MOOD_GENRES: Record<string, string[]> = {
  Happy: ['Comedy', 'Adventure', 'Animation'],
  Relaxed: ['Comedy', 'Romance', 'Animation', 'Family'],
  Tired: ['Comedy', 'Animation', 'Family'],
  Stressed: ['Comedy', 'Animation', 'Fantasy'],
  Romantic: ['Romance', 'Drama', 'Comedy'],
  Adventurous: ['Adventure', 'Action', 'Sci-Fi', 'Fantasy'],
  Curious: ['Mystery', 'Documentary', 'Sci-Fi', 'Crime'],
  Sad: ['Drama', 'Family', 'Comedy'],
};

export const LANGUAGE_CODES: Record<string, string> = {
  English: 'en',
  Hindi: 'hi',
  Tamil: 'ta',
  Telugu: 'te',
  Korean: 'ko',
  Japanese: 'ja',
  Spanish: 'es',
  French: 'fr',
};

// In-memory cache for OMDb lookups (1 hour)
interface CachedOMDb {
  data: any;
  expiresAt: number;
}
const omdbCache = new Map<string, CachedOMDb>();

/**
 * Generate fallback template reason
 */
export function generateTemplateReason(movie: { title: string; genres: string[] }, mood: string, audience: string): string {
  const genreStr = movie.genres.slice(0, 2).join(' & ');
  if (audience === 'Family with kids') {
    return `A joyful, wholesome ${genreStr.toLowerCase()} that every age in the house will love tonight.`;
  }
  if (audience === 'Partner') {
    return `An atmospheric, engaging ${genreStr.toLowerCase()} pick crafted for a cozy evening for two.`;
  }
  if (audience === 'Friends') {
    return `A high-energy, entertaining ${genreStr.toLowerCase()} that is great to experience together.`;
  }
  switch (mood) {
    case 'Tired':
      return `Light, breezy, and effortlessly entertaining—ideal to unwind without thinking too hard.`;
    case 'Romantic':
      return `Rich in charm and chemistry, perfect for getting lost in a tender, captivating story.`;
    case 'Adventurous':
      return `An exhilarating journey full of momentum, stunning craft, and unforgettable moments.`;
    case 'Curious':
      return `Clever and engrossing, filled with unexpected twists that will keep you guessing.`;
    case 'Sad':
      return `Deeply comforting and heartwarming, offering a gentle lift just when you need it.`;
    case 'Relaxed':
      return `Calm and deeply satisfying, offering a smooth cinematic escape from the daily rush.`;
    case 'Stressed':
      return `Pure escapism and feel-good fun designed to melt away the day's tension.`;
    default:
      return `An uplifting, vibrant watch guaranteed to match your good vibes tonight.`;
  }
}

/**
 * Filter movies matching user preferences
 */
export function selectCandidateMovies(params: RecommendParams): MovieItem[] {
  const excludeSet = new Set(params.excludeIds || []);
  const isFamily = params.audience === 'Family with kids';
  const effectiveMature = !isFamily && Boolean(params.preferences?.mature);

  // Runtime threshold
  let maxMinutes = Infinity;
  if (params.maxRuntime === 'Under 90 min') maxMinutes = 90;
  else if (params.maxRuntime === 'Under 2 hours') maxMinutes = 120;
  else if (params.maxRuntime === 'Under 2.5 hours') maxMinutes = 150;

  // Desired genres
  const surpriseMe = params.genres.includes('Surprise me') || params.genres.length === 0;
  const moodGenreList = MOOD_GENRES[params.mood] || ['Comedy', 'Adventure'];
  const targetGenres = surpriseMe ? moodGenreList : params.genres.filter((g) => g !== 'Surprise me');

  // Desired languages
  const targetLangCodes: string[] = [];
  if (params.languages && params.languages.length > 0 && !params.languages.includes('Any')) {
    for (const lang of params.languages) {
      if (LANGUAGE_CODES[lang]) targetLangCodes.push(LANGUAGE_CODES[lang]);
    }
  }

  // Filter candidates
  const candidates = FALLBACK_CATALOG.filter((movie) => {
    if (excludeSet.has(movie.id)) return false;
    if (movie.runtime > maxMinutes) return false;

    // Family restrictions
    if (isFamily) {
      if (movie.isMature) return false;
      const isKidSafe =
        movie.genres.includes('Family') ||
        movie.genres.includes('Animation') ||
        movie.genres.includes('Comedy') ||
        movie.genres.includes('Adventure');
      const hasBad =
        movie.genres.includes('Horror') ||
        movie.genres.includes('Crime') ||
        movie.genres.includes('Thriller');
      if (!isKidSafe || hasBad) return false;
    } else if (!effectiveMature && movie.isMature) {
      return false;
    }

    // Language
    if (targetLangCodes.length > 0 && !targetLangCodes.includes(movie.language)) {
      return false;
    }

    // Highly rated
    if (params.preferences?.highlyRated && movie.rating < 7.0) {
      return false;
    }

    // Recent / Classics
    const currentYear = 2026;
    if (params.preferences?.recent && movie.year < currentYear - 5) {
      return false;
    }
    if (params.preferences?.classics && movie.year >= 2000) {
      return false;
    }

    // Check genre overlap
    const hasGenreMatch = movie.genres.some((g) => targetGenres.includes(g));
    return hasGenreMatch;
  });

  // Score candidates
  const scored = candidates.map((movie) => {
    let score = movie.rating * 2;
    const matchingGenres = movie.genres.filter((g) => targetGenres.includes(g)).length;
    score += matchingGenres * 3;

    if (params.preferences?.hiddenGems && movie.isHiddenGem) {
      score += 10;
    }
    return { movie, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Ensure 1 hidden gem if available
  let selected: MovieItem[] = [];
  const hiddenGems = scored.filter((s) => s.movie.isHiddenGem);
  const regular = scored.filter((s) => !s.movie.isHiddenGem);

  if (hiddenGems.length > 0) {
    selected.push(hiddenGems[0].movie);
  }

  for (const item of regular) {
    if (selected.length >= 3) break;
    if (!selected.some((m) => m.id === item.movie.id)) {
      selected.push(item.movie);
    }
  }

  // If still under 3, fill from remaining
  for (const item of scored) {
    if (selected.length >= 3) break;
    if (!selected.some((m) => m.id === item.movie.id)) {
      selected.push(item.movie);
    }
  }

  // Fallback: If still under 3 due to strict filters, pick closest from catalog
  if (selected.length < 3) {
    for (const movie of FALLBACK_CATALOG) {
      if (selected.length >= 3) break;
      if (!excludeSet.has(movie.id) && !selected.some((m) => m.id === movie.id)) {
        if (!isFamily || (!movie.isMature && !movie.genres.includes('Horror'))) {
          selected.push(movie);
        }
      }
    }
  }

  return selected.slice(0, 3);
}

/**
 * Fetch detailed movie data from OMDb by title and year
 */
async function fetchFromOMDb(title: string, year: number, apiKey: string): Promise<any | null> {
  const cacheKey = `${title}_${year}`.toLowerCase();
  const now = Date.now();
  const cached = omdbCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
    const url = `https://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(title)}&y=${year}&plot=short`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MovieNightPicker/1.0' } });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.Response === 'True') {
      omdbCache.set(cacheKey, { data, expiresAt: now + 3600 * 1000 });
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get recommendations enriched with live OMDb data
 */
export async function getRecommendationsWithOMDb(
  params: RecommendParams,
  omdbApiKey?: string
): Promise<MoviePick[]> {
  const candidates = selectCandidateMovies(params);

  // If OMDb API key is provided, enrich in parallel
  const enriched = await Promise.all(
    candidates.map(async (movie) => {
      let finalTitle = movie.title;
      let finalYear = movie.year;
      let finalRating = movie.rating;
      let finalRuntime = movie.runtime;
      let finalOverview = movie.overview;
      let finalPoster = movie.posterUrl;
      let finalGenres = movie.genres;

      if (omdbApiKey) {
        const omdbData = await fetchFromOMDb(movie.title, movie.year, omdbApiKey);
        if (omdbData) {
          if (omdbData.Title) finalTitle = omdbData.Title;
          if (omdbData.Year) {
            const parsedYear = parseInt(omdbData.Year, 10);
            if (!isNaN(parsedYear)) finalYear = parsedYear;
          }
          if (omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
            const parsedRating = parseFloat(omdbData.imdbRating);
            if (!isNaN(parsedRating)) finalRating = parsedRating;
          }
          if (omdbData.Runtime && omdbData.Runtime !== 'N/A') {
            const parsedRuntime = parseInt(omdbData.Runtime, 10);
            if (!isNaN(parsedRuntime)) finalRuntime = parsedRuntime;
          }
          if (omdbData.Plot && omdbData.Plot !== 'N/A') {
            finalOverview = omdbData.Plot;
          }
          if (omdbData.Poster && omdbData.Poster !== 'N/A' && omdbData.Poster.startsWith('http')) {
            finalPoster = omdbData.Poster;
          }
          if (omdbData.Genre && omdbData.Genre !== 'N/A') {
            const parsedGenres = omdbData.Genre.split(',').map((g: string) => g.trim());
            if (parsedGenres.length > 0) finalGenres = parsedGenres;
          }
        }
      }

      return {
        id: movie.id,
        title: finalTitle,
        year: finalYear,
        genres: finalGenres,
        runtime: finalRuntime,
        rating: finalRating,
        overview: finalOverview,
        posterUrl: finalPoster,
        providers: movie.providers,
        reason: generateTemplateReason({ title: finalTitle, genres: finalGenres }, params.mood, params.audience),
        isHiddenGem: movie.isHiddenGem,
      };
    })
  );

  // Ensure one hidden gem tag is active
  if (!enriched.some((p) => p.isHiddenGem) && enriched.length > 0) {
    enriched[enriched.length - 1].isHiddenGem = true;
  }

  return enriched;
}
