import path from 'path';
import { fileURLToPath } from 'url';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { DEFAULT_REGION } from './server/tmdb.js';
import { parseUserQuery } from './server/queryParser.js';
import { resolveTitle } from './server/titleResolver.js';
import { retrieveCandidates, fetchWatchProvidersForCandidate } from './server/retrieval.js';
import { filterAndRankCandidates } from './server/ranking.js';
import { ParsedPreferences, RecommendationResponse } from './server/types.js';

dotenv.config();

// Configuration Constants
export const DEFAULT_REGION_SETTING = DEFAULT_REGION;
export const AI_ENABLED = true;
const PORT = parseInt(process.env.PORT || '3000', 10);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security Headers - Permit embedding in AI Studio iFrame
app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

// CORS restricted to current host
app.use(cors({ origin: true }));
app.use(express.json({ limit: '60kb' }));

// In-memory rate limiting: 45 requests per 10 minutes per IP
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const rateLimits = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 10 * 60 * 1000;
const MAX_REQUESTS = 45;

function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const entry = rateLimits.get(ip);
  if (!entry || entry.resetTime <= now) {
    rateLimits.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  if (entry.count >= MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return;
  }

  entry.count += 1;
  next();
}

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Title Search & Resolution Endpoint
app.get('/api/search-title', rateLimiter, async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const mediaType = (req.query.mediaType as 'movie' | 'tv' | 'all') || 'movie';

    if (!query) {
      res.json({ matches: [], isAmbiguous: false });
      return;
    }

    const tmdbKey = process.env.TMDB_API_KEY?.trim();
    const result = await resolveTitle(query, mediaType, tmdbKey);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Parse Natural Language Query Endpoint
app.post('/api/parse-query', rateLimiter, async (req: Request, res: Response) => {
  try {
    const { query, structuredInputs } = req.body;
    if (typeof query !== 'string') {
      res.status(400).json({ error: 'Query must be a string' });
      return;
    }

    const parsed = await parseUserQuery(query, structuredInputs);
    res.json({ parsedPreferences: parsed });
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Main Recommendation Endpoint
app.post('/api/recommend', rateLimiter, async (req: Request, res: Response) => {
  try {
    const {
      query,
      isDirectSearch,
      mood,
      genres,
      audience,
      maxRuntime,
      languages,
      preferences,
      note,
      excludeIds,
      feedback,
      clarificationSelection,
    } = req.body;

    const tmdbApiKey = process.env.TMDB_API_KEY?.trim();
    const omdbApiKey = process.env.OMDB_API_KEY?.trim();

    // 1. Build or Parse Preferences
    let parsed: ParsedPreferences;

    // Structured form mapping - only populate if this is from the guided wizard or explicit
    const structuredInputs: Partial<ParsedPreferences> = {};
    if (!isDirectSearch) {
      if (mood && typeof mood === 'string') {
        structuredInputs.mood = [mood.toLowerCase()];
      }
      if (Array.isArray(genres) && genres.length > 0 && !genres.includes('Surprise me')) {
        structuredInputs.genres = genres;
      }
      if (audience === 'Family with kids') {
        structuredInputs.excludeGenres = ['Horror', 'Crime'];
        structuredInputs.excludeContent = ['violent'];
      }
      if (maxRuntime === 'Under 90 min') structuredInputs.maxRuntimeMinutes = 90;
      else if (maxRuntime === 'Under 2 hours') structuredInputs.maxRuntimeMinutes = 120;
      else if (maxRuntime === 'Under 2.5 hours') structuredInputs.maxRuntimeMinutes = 150;

      if (Array.isArray(languages) && languages.length > 0 && !languages.includes('Any')) {
        const codeMap: Record<string, string> = {
          English: 'en',
          Hindi: 'hi',
          Tamil: 'ta',
          Telugu: 'te',
          Korean: 'ko',
          Japanese: 'ja',
          Spanish: 'es',
          French: 'fr',
        };
        structuredInputs.language = codeMap[languages[0]] || null;
      }
    }

    // Apply feedback from previous interactions if any
    const likedSeedsFromFeedback = Array.isArray(feedback?.likedTitles) ? feedback.likedTitles : [];
    const dislikedTitlesFromFeedback = Array.isArray(feedback?.dislikedTitles) ? feedback.dislikedTitles : [];

    if (typeof query === 'string' && query.trim().length > 0) {
      parsed = await parseUserQuery(query.trim(), structuredInputs);
    } else {
      parsed = await parseUserQuery(note ? note.trim() : '', structuredInputs);
    }

    // Append feedback seeds and exclusions
    if (likedSeedsFromFeedback.length > 0) {
      parsed.likedTitles = Array.from(new Set([...parsed.likedTitles, ...likedSeedsFromFeedback]));
    }
    if (dislikedTitlesFromFeedback.length > 0) {
      parsed.dislikedTitles = Array.from(new Set([...parsed.dislikedTitles, ...dislikedTitlesFromFeedback]));
    }

    // If clarification was selected by user, adjust intensity, effort, or seed title
    if (typeof clarificationSelection === 'string' && clarificationSelection.trim().length > 0) {
      const lowerChoice = clarificationSelection.toLowerCase();
      if (lowerChoice.includes('easy') || lowerChoice.includes('breezy') || lowerChoice.includes('relax')) {
        parsed.watchEffort = 'low';
        parsed.intensity = 'low';
        parsed.clarificationNeeded = false;
      } else if (lowerChoice.includes('intense') || lowerChoice.includes('dark')) {
        parsed.watchEffort = 'high';
        parsed.intensity = 'high';
        parsed.clarificationNeeded = false;
      } else {
        // Disambiguation title selection: clean parenthetical year if present
        const cleanedTitle = clarificationSelection.replace(/\s*\([^)]*\)\s*$/, '').trim();
        if (cleanedTitle) {
          parsed.likedTitles = [cleanedTitle];
        }
        parsed.clarificationNeeded = false;
      }
    }

    // 2. Resolve Liked Titles to TMDB Seeds
    const resolvedSeeds = [];
    let titleDisambiguation: { title: string; question: string; options: string[] } | null = null;

    for (const title of parsed.likedTitles.slice(0, 3)) {
      const { matches, isAmbiguous } = await resolveTitle(title, parsed.mediaType, tmdbApiKey);
      if (matches.length > 0) {
        resolvedSeeds.push(matches[0]);
        if (isAmbiguous && matches.length >= 2) {
          titleDisambiguation = {
            title,
            question: `Multiple versions match "${title}". Which one did you mean?`,
            options: [
              `${matches[0].title} (${matches[0].year || 'Original'})`,
              `${matches[1].title} (${matches[1].year || 'Remake'})`,
            ],
          };
        }
      }
    }

    // 3. Candidate Retrieval (TMDB + OMDb + Catalog with Keywords)
    const candidates = await retrieveCandidates(parsed, resolvedSeeds, tmdbApiKey, omdbApiKey);

    // 4. Filtering and Multi-Signal Ranking
    const rawExcludeIds: number[] = Array.isArray(excludeIds) ? excludeIds.filter((id) => typeof id === 'number') : [];
    const { ranked, groups } = filterAndRankCandidates(candidates, parsed, resolvedSeeds, rawExcludeIds);

    // 5. Watch Provider Enrichment for Top Picks
    const topCandidates = ranked.slice(0, 6);
    const enrichedPromises = topCandidates.map((c) =>
      fetchWatchProvidersForCandidate(c, parsed.region || DEFAULT_REGION, tmdbApiKey)
    );
    const finalTopPicks = await Promise.all(enrichedPromises);

    // Replace the first picks with the enriched provider data
    const finalRanked = [
      ...finalTopPicks,
      ...ranked.slice(finalTopPicks.length),
    ];

    const clarificationPayload = parsed.clarificationNeeded
      ? {
          question: parsed.clarificationQuestion || 'Do you want an easy watch or something more intense?',
          options: ['Easy-to-follow action', 'Darker / more intense'],
        }
      : titleDisambiguation
      ? {
          question: titleDisambiguation.question,
          options: titleDisambiguation.options,
        }
      : null;

    const responsePayload: RecommendationResponse = {
      movies: finalRanked.slice(0, 3),
      groups,
      clarification: clarificationPayload,
      parsedPreferences: parsed,
    };

    res.json(responsePayload);
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Vite or Static Serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    // Server running
  });
}

// Start server in standalone Node.js environments (skip when running as a Vercel serverless function)
if (!process.env.VERCEL) {
  startServer();
}

export { app };
export default app;
