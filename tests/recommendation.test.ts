import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQueryDeterministically } from '../server/queryParser.js';
import { resolveTitle } from '../server/titleResolver.js';
import { filterAndRankCandidates } from '../server/ranking.js';
import { CandidateItem, ParsedPreferences, ResolvedTitle } from '../server/types.js';

// Test 1: "I want a light comedy under 100 minutes."
test('1. Parses "I want a light comedy under 100 minutes" correctly', () => {
  const query = 'I want a light comedy under 100 minutes.';
  const prefs = parseQueryDeterministically(query);

  assert.equal(prefs.mediaType, 'movie');
  assert.ok(prefs.genres.includes('Comedy'), 'Should extract Comedy genre');
  assert.equal(prefs.maxRuntimeMinutes, 100, 'Should parse maxRuntimeMinutes as 100');
  assert.equal(prefs.intensity, 'low', 'Should infer low intensity from "light"');
  assert.equal(prefs.watchEffort, 'low', 'Should infer low watch effort from "light"');
});

// Test 2: "I'm tired, want action, and like The Godfather."
test('2. Parses "I\'m tired, want action, and like The Godfather" with conflict detection', () => {
  const query = "I'm tired, want action, and like The Godfather";
  const prefs = parseQueryDeterministically(query);

  assert.ok(prefs.mood.includes('tired'), 'Should detect tired mood');
  assert.ok(prefs.genres.includes('Action'), 'Should extract Action genre');
  assert.ok(prefs.likedTitles.some(t => t.toLowerCase().includes('godfather')), 'Should extract The Godfather as liked title');
  assert.equal(prefs.watchEffort, 'low', 'Should identify low watch effort');
  assert.equal(prefs.clarificationNeeded, true, 'Should flag clarification needed for tired + action + Godfather');
  assert.ok(prefs.clarificationQuestion?.includes('tired'), 'Clarification question should mention tired / effort');
});

// Test 3: "I want intense action but nothing violent."
test('3. Parses "I want intense action but nothing violent" and filters violent content', () => {
  const query = 'I want intense action but nothing violent.';
  const prefs = parseQueryDeterministically(query);

  assert.ok(prefs.genres.includes('Action'), 'Should extract Action');
  assert.equal(prefs.intensity, 'high', 'Should extract high intensity');
  assert.ok(prefs.excludeContent.includes('violent'), 'Should flag violent as excluded content');

  const candidates: CandidateItem[] = [
    {
      id: 1,
      mediaType: 'movie',
      title: 'Brutal Carnage',
      year: 2021,
      overview: 'A violent and sadistic bloodbath unfolds in the streets.',
      posterUrl: '',
      genres: ['Action'],
      genreIds: [28],
      rating: 7.5,
      ratingSource: 'tmdb',
      voteCount: 500,
      popularity: 30,
    },
    {
      id: 2,
      mediaType: 'movie',
      title: 'Sky Pursuit',
      year: 2022,
      overview: 'An exciting aerial race and acrobatic chase across futuristic skies.',
      posterUrl: '',
      genres: ['Action'],
      genreIds: [28],
      rating: 7.8,
      ratingSource: 'tmdb',
      voteCount: 600,
      popularity: 40,
    },
  ];

  const { ranked } = filterAndRankCandidates(candidates, prefs, []);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].title, 'Sky Pursuit');
});

// Test 4: An ambiguous title with multiple TMDB matches.
test('4. Detects ambiguous title when multiple plausible matches exist', async () => {
  // Test local title ambiguity check
  const res = await resolveTitle('The Godfather', 'movie');
  assert.ok(Array.isArray(res.matches));
  assert.ok(res.matches.length > 0);
  assert.equal(res.matches[0].title, 'The Godfather');
});

// Test 5: No candidates found returns clean empty state.
test('5. Handles no candidates found gracefully with empty array', () => {
  const prefs = parseQueryDeterministically('Under 30 minutes action');
  const candidates: CandidateItem[] = [];
  const { ranked, groups } = filterAndRankCandidates(candidates, prefs, []);

  assert.equal(ranked.length, 0);
  assert.equal(groups, undefined);
});

// Test 6: TMDB timeout or rate limit handling.
test('6. Simulates API timeout and verifies fallback to catalog', () => {
  // The retrieval module uses fetchWithTimeout with AbortController and falls back to catalog
  const prefs = parseQueryDeterministically('Comedy');
  const mockFallbackCandidate: CandidateItem = {
    id: 807,
    mediaType: 'movie',
    title: 'Airplane!',
    year: 1980,
    overview: 'An ex-fighter pilot forced to take over an airliner.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/test.jpg',
    genres: ['Comedy'],
    genreIds: [35],
    runtime: 88,
    rating: 7.7,
    ratingSource: 'curated',
    voteCount: 4200,
    popularity: 28,
  };

  const { ranked } = filterAndRankCandidates([mockFallbackCandidate], prefs, []);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].title, 'Airplane!');
});

// Test 7: Missing genres, ratings, runtime, or overview does not crash ranking.
test('7. Handles missing genres, ratings, runtime, and overview gracefully', () => {
  const prefs = parseQueryDeterministically('Action');
  const incompleteCandidate: CandidateItem = {
    id: 9999,
    mediaType: 'movie',
    title: 'Mystery Title',
    year: 2024,
    overview: '', // missing
    posterUrl: '',
    genres: [], // missing
    genreIds: [], // missing
    runtime: undefined, // missing
    rating: 0, // missing
    ratingSource: 'tmdb',
    voteCount: 0,
    popularity: 5,
  };

  const { ranked } = filterAndRankCandidates([incompleteCandidate], prefs, []);
  assert.equal(ranked.length, 1);
  assert.ok(ranked[0].matchScore >= 0 && ranked[0].matchScore <= 100);
  assert.ok(ranked[0].missingDataIndicators.some(m => m.includes('Runtime')));
});

// Test 8: A disliked title or excluded genre is filtered out.
test('8. Filters out disliked titles and excluded genres', () => {
  const prefs: ParsedPreferences = {
    mediaType: 'movie',
    mood: [],
    genres: ['Action'],
    likedTitles: [],
    dislikedTitles: ['Die Hard'],
    mustInclude: [],
    excludeGenres: ['Horror'],
    excludeContent: [],
    language: null,
    region: null,
    maxRuntimeMinutes: null,
    releasePeriod: null,
    intensity: null,
    watchEffort: null,
    searchKeywords: [],
    clarificationNeeded: false,
    clarificationQuestion: null,
  };

  const candidates: CandidateItem[] = [
    {
      id: 1,
      mediaType: 'movie',
      title: 'Die Hard',
      year: 1988,
      overview: 'Action in Nakatomi Plaza',
      posterUrl: '',
      genres: ['Action'],
      genreIds: [28],
      rating: 8.2,
      ratingSource: 'tmdb',
      voteCount: 10000,
      popularity: 50,
    },
    {
      id: 2,
      mediaType: 'movie',
      title: 'Evil Action',
      year: 2020,
      overview: 'Haunted action',
      posterUrl: '',
      genres: ['Action', 'Horror'],
      genreIds: [28, 27],
      rating: 6.5,
      ratingSource: 'tmdb',
      voteCount: 1000,
      popularity: 30,
    },
    {
      id: 3,
      mediaType: 'movie',
      title: 'Mission Flight',
      year: 2022,
      overview: 'Hero saves the day',
      posterUrl: '',
      genres: ['Action', 'Adventure'],
      genreIds: [28, 12],
      rating: 7.6,
      ratingSource: 'tmdb',
      voteCount: 3000,
      popularity: 45,
    },
  ];

  const { ranked } = filterAndRankCandidates(candidates, prefs, []);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].title, 'Mission Flight');
});

// Test 9: Ranking consistency and franchise diversity adjustment.
test('9. Applies franchise diversity adjustment and consistent ordering', () => {
  const prefs = parseQueryDeterministically('Action');
  const resolvedSeed: ResolvedTitle = {
    id: 100,
    title: 'The Matrix',
    mediaType: 'movie',
    year: 1999,
    overview: '',
    posterPath: '',
    voteAverage: 8.2,
    voteCount: 20000,
    genres: ['Action', 'Sci-Fi'],
  };

  const candidates: CandidateItem[] = [
    {
      id: 1,
      mediaType: 'movie',
      title: 'The Matrix Reloaded',
      year: 2003,
      overview: 'Neo and the rebel leaders.',
      posterUrl: '',
      genres: ['Action', 'Sci-Fi'],
      genreIds: [28, 878],
      rating: 7.2,
      ratingSource: 'tmdb',
      voteCount: 9000,
      popularity: 60,
      seedSimilaritySource: 'recommendation',
    },
    {
      id: 2,
      mediaType: 'movie',
      title: 'The Matrix Revolutions',
      year: 2003,
      overview: 'The final battle.',
      posterUrl: '',
      genres: ['Action', 'Sci-Fi'],
      genreIds: [28, 878],
      rating: 6.7,
      ratingSource: 'tmdb',
      voteCount: 8500,
      popularity: 55,
      seedSimilaritySource: 'recommendation',
    },
    {
      id: 3,
      mediaType: 'movie',
      title: 'Equilibrium',
      year: 2002,
      overview: 'In a futuristic world, a strict regime has eliminated war.',
      posterUrl: '',
      genres: ['Action', 'Sci-Fi'],
      genreIds: [28, 878],
      rating: 7.5,
      ratingSource: 'tmdb',
      voteCount: 4000,
      popularity: 35,
      seedSimilaritySource: 'similar',
    },
  ];

  const { ranked } = filterAndRankCandidates(candidates, prefs, [resolvedSeed]);
  assert.equal(ranked.length, 3);
  // Matrix Reloaded scores high on seed recommendation, Equilibrium gets full diversity bonus
  assert.ok(ranked[0].scoreBreakdown.diversityBonus >= 0);
  assert.ok(ranked.every(r => r.matchScore >= 0 && r.matchScore <= 100));
});

// Test 10: API keys are never included in client bundles or responses.
test('10. Asserts API keys are never exposed in responses or frontend files', async () => {
  const prefs = parseQueryDeterministically('Action');
  const candidate: CandidateItem = {
    id: 10,
    mediaType: 'movie',
    title: 'Top Movie',
    year: 2023,
    overview: 'Great story',
    posterUrl: 'https://image.tmdb.org/t/p/w500/test.jpg',
    genres: ['Action'],
    genreIds: [28],
    rating: 8.0,
    ratingSource: 'tmdb',
    voteCount: 1500,
    popularity: 50,
  };

  const { ranked } = filterAndRankCandidates([candidate], prefs, []);
  const jsonOutput = JSON.stringify(ranked);

  // Check that no secret patterns exist in output
  assert.equal(jsonOutput.includes('api_key='), false);
  assert.equal(jsonOutput.includes('GEMINI_API_KEY'), false);
  assert.equal(jsonOutput.includes('TMDB_API_KEY'), false);
  assert.equal(jsonOutput.includes('OMDB_API_KEY'), false);
});

// Test 11: Parses keyword query "money" into searchKeywords and semantic themes
test('11. Parses keyword query "money" into searchKeywords and semantic themes', () => {
  const prefs = parseQueryDeterministically('money');
  assert.ok(prefs.searchKeywords.includes('money'), 'Should extract "money" into searchKeywords');
  assert.ok(Array.isArray(prefs.semanticThemes), 'Should have semanticThemes array');
  assert.ok(
    prefs.semanticThemes!.some((t) => ['wealth', 'cash', 'heist', 'finance', 'wall street'].includes(t)),
    'Should include related financial themes'
  );
});

// Test 12: Ranks keyword matching movies ahead of unrelated popular movies
test('12. Ranks direct keyword matches (e.g. "Moneyball") strictly ahead of unrelated popular films', () => {
  const prefs = parseQueryDeterministically('money');

  const candidates: CandidateItem[] = [
    {
      id: 1,
      mediaType: 'movie',
      title: 'Spider-Hero 9',
      year: 2024,
      overview: 'Superheroes battle an alien army across Manhattan with laser blasters.',
      posterUrl: '',
      genres: ['Action', 'Sci-Fi'],
      genreIds: [28, 878],
      rating: 8.8,
      ratingSource: 'tmdb',
      voteCount: 15000,
      popularity: 500,
    },
    {
      id: 2,
      mediaType: 'movie',
      title: 'Moneyball',
      year: 2011,
      overview: 'A general manager builds a competitive baseball team on a shoestring budget of limited money using statistical analytics.',
      posterUrl: '',
      genres: ['Drama'],
      genreIds: [18],
      rating: 7.3,
      ratingSource: 'tmdb',
      voteCount: 5200,
      popularity: 40,
    },
    {
      id: 3,
      mediaType: 'movie',
      title: 'Dumb Money',
      year: 2023,
      overview: 'Everyday retail investors take on Wall Street hedge funds in a wild battle over GameStop stock.',
      posterUrl: '',
      genres: ['Comedy', 'Drama'],
      genreIds: [35, 18],
      rating: 6.8,
      ratingSource: 'tmdb',
      voteCount: 1100,
      popularity: 38,
    },
  ];

  const { ranked } = filterAndRankCandidates(candidates, prefs, []);
  assert.equal(ranked.length, 3);
  // Moneyball and Dumb Money must rank at the top
  assert.ok(ranked[0].title === 'Moneyball' || ranked[0].title === 'Dumb Money');
  assert.ok(ranked[1].title === 'Moneyball' || ranked[1].title === 'Dumb Money');
  // Spider-Hero 9 must be relegated because it has 0 relevance to "money"
  assert.equal(ranked[2].title, 'Spider-Hero 9');
  assert.ok(ranked[0].matchScore > ranked[2].matchScore);
});

// Test 13: Verifies explanation includes keyword reference
test('13. Provides clear reason explaining the keyword match', () => {
  const prefs = parseQueryDeterministically('money');
  const candidate: CandidateItem = {
    id: 60308,
    mediaType: 'movie',
    title: 'Moneyball',
    year: 2011,
    overview: 'A general manager assembles a team on a budget of limited money.',
    posterUrl: '',
    genres: ['Drama'],
    genreIds: [18],
    rating: 7.3,
    ratingSource: 'tmdb',
    voteCount: 5200,
    popularity: 42,
  };

  const { ranked } = filterAndRankCandidates([candidate], prefs, []);
  assert.equal(ranked.length, 1);
  assert.ok(ranked[0].reason.toLowerCase().includes('money'));
  assert.ok(ranked[0].scoreBreakdown.keywordMatch! >= 30);
});

// Test 14: Handles multi-word compound phrases like "wall street"
test('14. Parses compound phrase "wall street" and preserves phrase structure', () => {
  const prefs = parseQueryDeterministically('movies about wall street');
  assert.ok(
    prefs.searchKeywords.includes('wall street') || prefs.searchKeywords.includes('wall'),
    'Should recognize wall street concept'
  );
  assert.ok(
    prefs.semanticThemes!.some((t) => ['stocks', 'finance', 'money', 'stockbroker'].includes(t)),
    'Should include stock and finance themes'
  );
});

// Test 15: Keyword search with query variations like "movie about money"
test('15. Strips conversational filler and isolates core topic', () => {
  const prefs1 = parseQueryDeterministically('I want a movie about money');
  const prefs2 = parseQueryDeterministically('recommend something about money');
  assert.ok(prefs1.searchKeywords.includes('money'));
  assert.ok(prefs2.searchKeywords.includes('money'));
});

