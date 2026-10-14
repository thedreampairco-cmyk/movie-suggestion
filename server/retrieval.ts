import { CandidateItem, ParsedPreferences, ResolvedTitle } from './types.js';
import { FALLBACK_CATALOG } from './catalog.js';

const GENRE_MAP_MOVIE: Record<string, number> = {
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 14,
  Horror: 27,
  Mystery: 9648,
  Romance: 10749,
  'Sci-Fi': 878,
  Thriller: 53,
};

const GENRE_MAP_TV: Record<string, number> = {
  Action: 10759,
  Adventure: 10759,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 10765,
  Mystery: 9648,
  'Sci-Fi': 10765,
};

// In-memory cache for candidate queries
interface CachedCandidates {
  data: CandidateItem[];
  expiresAt: number;
}
const retrievalCache = new Map<string, CachedCandidates>();

/**
 * Fetch with timeout and graceful error recovery
 */
async function fetchWithTimeout(url: string, timeoutMs = 4500): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MovieNightPicker/2.0' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Check if candidate title or overview matches search keywords or themes
 */
function evaluateKeywordMatch(
  item: { title: string; overview: string; genres?: string[] },
  keywords: string[],
  themes: string[]
): { isMatch: boolean; matchedTerms: string[]; inTitle: boolean } {
  const matchedTerms: string[] = [];
  const titleLower = item.title.toLowerCase();
  const overviewLower = item.overview.toLowerCase();
  let inTitle = false;

  const allTerms = Array.from(new Set([...keywords, ...themes]));

  for (const term of allTerms) {
    const t = term.toLowerCase().trim();
    if (!t || t.length < 2) continue;

    // Word boundary match
    const titleRegex = new RegExp(`\\b${t}\\b`, 'i');
    const overviewRegex = new RegExp(`\\b${t}\\b`, 'i');

    if (titleRegex.test(titleLower) || titleLower.includes(t)) {
      matchedTerms.push(t);
      inTitle = true;
    } else if (overviewRegex.test(overviewLower) || overviewLower.includes(t)) {
      matchedTerms.push(t);
    }
  }

  return {
    isMatch: matchedTerms.length > 0,
    matchedTerms,
    inTitle,
  };
}

/**
 * Retrieve candidates from TMDB, OMDb, and Curated Catalog
 */
export async function retrieveCandidates(
  prefs: ParsedPreferences,
  resolvedSeeds: ResolvedTitle[],
  apiKey?: string,
  omdbApiKey?: string
): Promise<CandidateItem[]> {
  const cacheKey = JSON.stringify({
    mediaType: prefs.mediaType,
    genres: prefs.genres,
    keywords: prefs.searchKeywords,
    themes: prefs.semanticThemes,
    seeds: resolvedSeeds.map((s) => `${s.mediaType}:${s.id}`),
    lang: prefs.language,
    runtime: prefs.maxRuntimeMinutes,
  });

  const now = Date.now();
  const cached = retrievalCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const candidateMap = new Map<string, CandidateItem>();
  const searchKeywords = prefs.searchKeywords || [];
  const semanticThemes = prefs.semanticThemes || [];
  const effectiveOmdbKey = omdbApiKey || process.env.OMDB_API_KEY;

  // Helper to add or enrich a candidate in candidateMap
  const addCandidate = (item: CandidateItem, source?: CandidateItem['seedSimilaritySource']) => {
    const key = `${item.mediaType}:${item.id}`;
    const evalMatch = evaluateKeywordMatch(item, searchKeywords, semanticThemes);

    if (candidateMap.has(key)) {
      const existing = candidateMap.get(key)!;
      if (evalMatch.isMatch) {
        existing.keywordMatched = true;
        existing.matchedKeywords = Array.from(new Set([...(existing.matchedKeywords || []), ...evalMatch.matchedTerms]));
      }
      return;
    }

    item.keywordMatched = evalMatch.isMatch;
    item.matchedKeywords = evalMatch.matchedTerms;
    if (source && !item.seedSimilaritySource) {
      item.seedSimilaritySource = source;
    }
    candidateMap.set(key, item);
  };

  // 1. KEYWORD & THEME RETRIEVAL (TMDB)
  if (apiKey && searchKeywords.length > 0) {
    for (const kw of searchKeywords.slice(0, 3)) {
      // 1A. Search TMDB Keyword IDs (e.g. "money" -> keyword id 10594)
      const kwSearchUrl = `https://api.themoviedb.org/3/search/keyword?api_key=${apiKey}&query=${encodeURIComponent(kw)}&page=1`;
      const kwData = await fetchWithTimeout(kwSearchUrl);
      if (kwData && Array.isArray(kwData.results) && kwData.results.length > 0) {
        const topKw = kwData.results[0];
        // Discover top-rated / popular movies with this keyword ID
        const kwDiscoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_keywords=${topKw.id}&sort_by=popularity.desc&vote_count.gte=30&page=1`;
        const kwMovies = await fetchWithTimeout(kwDiscoverUrl);
        if (kwMovies && Array.isArray(kwMovies.results)) {
          for (const item of kwMovies.results.slice(0, 10)) {
            if (!item.poster_path) continue;
            const dateStr = item.release_date || '';
            const year = dateStr ? parseInt(dateStr.split('-')[0], 10) : 2020;
            addCandidate({
              id: item.id,
              mediaType: 'movie',
              title: item.title || '',
              year: isNaN(year) ? 2020 : year,
              overview: item.overview || '',
              posterUrl: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
              backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : undefined,
              genres: [],
              genreIds: item.genre_ids || [],
              rating: parseFloat((item.vote_average || 7.0).toFixed(1)),
              ratingSource: 'tmdb',
              voteCount: item.vote_count || 100,
              popularity: item.popularity || 20,
              seedSimilaritySource: 'keyword',
              keywordMatched: true,
              matchedKeywords: [kw],
            }, 'keyword');
          }
        }
      }

      // 1B. Direct Title Search on TMDB
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(kw)}&include_adult=false&page=1`;
      const searchData = await fetchWithTimeout(searchUrl);
      if (searchData && Array.isArray(searchData.results)) {
        for (const item of searchData.results.slice(0, 10)) {
          if (!item.poster_path) continue;
          const dateStr = item.release_date || '';
          const year = dateStr ? parseInt(dateStr.split('-')[0], 10) : 2020;
          addCandidate({
            id: item.id,
            mediaType: 'movie',
            title: item.title || '',
            year: isNaN(year) ? 2020 : year,
            overview: item.overview || '',
            posterUrl: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
            backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : undefined,
            genres: [],
            genreIds: item.genre_ids || [],
            rating: parseFloat((item.vote_average || 7.0).toFixed(1)),
            ratingSource: 'tmdb',
            voteCount: item.vote_count || 100,
            popularity: item.popularity || 20,
            seedSimilaritySource: 'keyword',
            keywordMatched: true,
            matchedKeywords: [kw],
          }, 'keyword');
        }
      }
    }
  }

  // 2. LIVE OMDB KEYWORD RETRIEVAL (Enrich or Supplement)
  if (effectiveOmdbKey && searchKeywords.length > 0) {
    for (const kw of searchKeywords.slice(0, 2)) {
      const omdbSearchUrl = `https://www.omdbapi.com/?apikey=${effectiveOmdbKey}&s=${encodeURIComponent(kw)}&type=movie`;
      const omdbData = await fetchWithTimeout(omdbSearchUrl, 3000);
      if (omdbData && Array.isArray(omdbData.Search)) {
        for (const omdbItem of omdbData.Search.slice(0, 5)) {
          if (!omdbItem.Poster || omdbItem.Poster === 'N/A' || !omdbItem.Poster.startsWith('http')) continue;
          // Check if already in candidateMap by title
          const existing = Array.from(candidateMap.values()).find(
            (c) => c.title.toLowerCase() === omdbItem.Title.toLowerCase()
          );
          if (!existing) {
            const parsedYear = parseInt(omdbItem.Year, 10) || 2020;
            const pseudoId = Math.abs(
              omdbItem.Title.split('').reduce((acc: number, char: string) => acc * 31 + char.charCodeAt(0), 0)
            ) % 1000000;

            addCandidate({
              id: pseudoId,
              mediaType: 'movie',
              title: omdbItem.Title,
              year: parsedYear,
              overview: `An acclaimed feature centered around ${kw}.`,
              posterUrl: omdbItem.Poster,
              genres: [],
              genreIds: [],
              rating: 7.2,
              ratingSource: 'omdb',
              voteCount: 1000,
              popularity: 30,
              seedSimilaritySource: 'keyword',
              keywordMatched: true,
              matchedKeywords: [kw],
            }, 'keyword');
          }
        }
      }
    }
  }

  // 3. SEED-BASED RETRIEVAL (Recommendations & Similar Titles)
  if (apiKey && resolvedSeeds.length > 0) {
    for (const seed of resolvedSeeds) {
      const endpoints = [
        `https://api.themoviedb.org/3/${seed.mediaType}/${seed.id}/recommendations?api_key=${apiKey}&page=1`,
        `https://api.themoviedb.org/3/${seed.mediaType}/${seed.id}/similar?api_key=${apiKey}&page=1`,
      ];

      const results = await Promise.all(endpoints.map((u) => fetchWithTimeout(u)));
      for (let i = 0; i < results.length; i++) {
        const data = results[i];
        if (!data || !Array.isArray(data.results)) continue;
        const source = i === 0 ? 'recommendation' : 'similar';

        for (const item of data.results.slice(0, 10)) {
          if (!item.poster_path) continue;
          const isTv = Boolean(item.first_air_date || item.name);
          const type: 'movie' | 'tv' = isTv ? 'tv' : 'movie';
          const dateStr = item.release_date || item.first_air_date || '';
          const year = dateStr ? parseInt(dateStr.split('-')[0], 10) : 2020;

          addCandidate({
            id: item.id,
            mediaType: type,
            title: item.title || item.name || '',
            year: isNaN(year) ? 2020 : year,
            overview: item.overview || '',
            posterUrl: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
            backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : undefined,
            genres: [],
            genreIds: item.genre_ids || [],
            rating: parseFloat((item.vote_average || 7.0).toFixed(1)),
            ratingSource: 'tmdb',
            voteCount: item.vote_count || 100,
            popularity: item.popularity || 20,
            seedSimilaritySource: source,
          }, source);
        }
      }
    }
  }

  // 4. DISCOVER RETRIEVAL (Genres, Mood, Runtime, Language)
  if (apiKey) {
    const targetTypes: ('movie' | 'tv')[] =
      prefs.mediaType === 'all' ? ['movie', 'tv'] : [prefs.mediaType];

    for (const type of targetTypes) {
      const genreMap = type === 'movie' ? GENRE_MAP_MOVIE : GENRE_MAP_TV;
      const genreIds = prefs.genres.map((g) => genreMap[g]).filter(Boolean);

      const params = new URLSearchParams();
      params.set('api_key', apiKey);
      params.set('sort_by', 'popularity.desc');
      params.set('include_adult', 'false');
      params.set('vote_count.gte', '100');
      params.set('vote_average.gte', '6.0');

      if (genreIds.length > 0) {
        params.set('with_genres', genreIds.join('|'));
      }

      if (prefs.maxRuntimeMinutes && type === 'movie') {
        params.set('with_runtime.lte', String(prefs.maxRuntimeMinutes));
      }

      if (prefs.language && prefs.language !== 'any') {
        params.set('with_original_language', prefs.language);
      }

      if (prefs.releasePeriod?.startYear) {
        const field = type === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte';
        params.set(field, `${prefs.releasePeriod.startYear}-01-01`);
      }

      const discoverUrl = `https://api.themoviedb.org/3/discover/${type}?${params.toString()}&page=1`;
      const data = await fetchWithTimeout(discoverUrl);

      if (data && Array.isArray(data.results)) {
        for (const item of data.results.slice(0, 15)) {
          if (!item.poster_path) continue;
          const dateStr = item.release_date || item.first_air_date || '';
          const year = dateStr ? parseInt(dateStr.split('-')[0], 10) : 2020;

          addCandidate({
            id: item.id,
            mediaType: type,
            title: item.title || item.name || '',
            year: isNaN(year) ? 2020 : year,
            overview: item.overview || '',
            posterUrl: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
            backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : undefined,
            genres: [],
            genreIds: item.genre_ids || [],
            rating: parseFloat((item.vote_average || 7.0).toFixed(1)),
            ratingSource: 'tmdb',
            voteCount: item.vote_count || 100,
            popularity: item.popularity || 20,
            seedSimilaritySource: 'genre',
          }, 'genre');
        }
      }
    }
  }

  // 5. CURATED CATALOG RETRIEVAL (Fallback & Semantic Augmentation)
  // Check catalog for keyword matches first
  const catalogMatches: CandidateItem[] = [];
  const catalogOthers: CandidateItem[] = [];

  for (const m of FALLBACK_CATALOG) {
    const item: CandidateItem = {
      id: m.id,
      mediaType: 'movie',
      title: m.title,
      year: m.year,
      overview: m.overview,
      posterUrl: m.posterUrl,
      genres: m.genres,
      genreIds: m.genres.map((g) => GENRE_MAP_MOVIE[g]).filter(Boolean),
      runtime: m.runtime,
      rating: m.rating,
      ratingSource: 'curated',
      voteCount: m.voteCount,
      popularity: m.popularity,
      language: m.language,
      isMature: m.isMature,
      providers: m.providers,
    };

    const evalMatch = evaluateKeywordMatch(item, searchKeywords, semanticThemes);
    if (evalMatch.isMatch) {
      item.keywordMatched = true;
      item.matchedKeywords = evalMatch.matchedTerms;
      item.seedSimilaritySource = 'keyword';
      catalogMatches.push(item);
    } else {
      catalogOthers.push(item);
    }
  }

  // If searchKeywords exist, prioritize matched catalog items
  if (searchKeywords.length > 0) {
    for (const cm of catalogMatches) {
      addCandidate(cm, 'keyword');
    }
  }

  // If candidate count is still low or without API key, supplement from catalog
  if (candidateMap.size < 6) {
    const pool = searchKeywords.length > 0 ? [...catalogMatches, ...catalogOthers] : catalogOthers;
    for (const item of pool) {
      addCandidate(item);
      if (candidateMap.size >= 15) break;
    }
  }

  const resultList = Array.from(candidateMap.values());
  retrievalCache.set(cacheKey, { data: resultList, expiresAt: now + 3600 * 1000 });
  return resultList;
}

/**
 * Fetch watch providers for a candidate
 */
export async function fetchWatchProvidersForCandidate<T extends CandidateItem>(
  candidate: T,
  region: string = 'IN',
  apiKey?: string
): Promise<T> {
  if (!apiKey || candidate.providers) return candidate;

  try {
    const url = `https://api.themoviedb.org/3/${candidate.mediaType}/${candidate.id}/watch/providers?api_key=${apiKey}`;
    const data = await fetchWithTimeout(url, 2500);
    if (!data || !data.results) return candidate;

    const regionData = data.results[region] || data.results.US;
    if (!regionData) return candidate;

    const providers: { name: string; logoUrl: string; type?: string }[] = [];
    const seen = new Set<string>();

    if (Array.isArray(regionData.flatrate)) {
      for (const p of regionData.flatrate.slice(0, 3)) {
        if (!seen.has(p.provider_name)) {
          seen.add(p.provider_name);
          providers.push({
            name: p.provider_name,
            logoUrl: `https://image.tmdb.org/t/p/w92${p.logo_path}`,
            type: 'Stream',
          });
        }
      }
    }

    if (providers.length < 3 && Array.isArray(regionData.rent)) {
      for (const p of regionData.rent.slice(0, 3 - providers.length)) {
        if (!seen.has(p.provider_name)) {
          seen.add(p.provider_name);
          providers.push({
            name: p.provider_name,
            logoUrl: `https://image.tmdb.org/t/p/w92${p.logo_path}`,
            type: 'Rent',
          });
        }
      }
    }

    return { ...candidate, providers };
  } catch {
    return candidate;
  }
}
