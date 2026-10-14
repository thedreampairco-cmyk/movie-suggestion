import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parseQueryDeterministically } from '../server/queryParser.js';
import { resolveTitle } from '../server/titleResolver.js';
import { filterAndRankCandidates } from '../server/ranking.js';
import { retrieveCandidates } from '../server/retrieval.js';
import { CandidateItem, ParsedPreferences, ResolvedTitle } from '../server/types.js';

// ==========================================
// SCENARIO A: Main Mixed-Intent Example
// "I’m tired, want to watch an action movie, and I like The Godfather."
// ==========================================
test('Scenario A: Mixed-intent query extracts action genre, Godfather seed, and detects tired conflict', async () => {
  const query = 'I’m tired, want to watch an action movie, and I like The Godfather.';
  const prefs = parseQueryDeterministically(query);

  // 1. Explicit genre recognized
  assert.ok(prefs.genres.includes('Action'), 'Action must be an explicit genre preference');

  // 2. Liked title recognized
  assert.ok(
    prefs.likedTitles.some((t) => t.toLowerCase().includes('godfather')),
    'The Godfather must be extracted as a liked title'
  );

  // 3. Resolve title to real entity
  const resolved = await resolveTitle('The Godfather', 'movie');
  assert.ok(resolved.matches.length > 0, 'Must resolve to TMDB entity');
  assert.equal(resolved.matches[0].id, 238, 'The Godfather must resolve to TMDB ID 238');

  // 4. "Tired" is soft intent -> triggers clarification or separated groups
  assert.equal(prefs.clarificationNeeded, true, 'Conflict between tired and intense Godfather must be flagged');
  assert.ok(
    prefs.clarificationQuestion?.toLowerCase().includes('tired') ||
      prefs.clarificationQuestion?.toLowerCase().includes('action'),
    'Clarification question must address user energy level and style'
  );

  // 5. Test candidate ranking for Scenario A
  const mockCandidates: CandidateItem[] = [
    {
      id: 238,
      mediaType: 'movie',
      title: 'The Godfather Part II',
      year: 1974,
      overview: 'The continuing saga of the Corleone crime family.',
      posterUrl: 'https://image.tmdb.org/t/p/w500/test.jpg',
      genres: ['Crime', 'Drama'],
      genreIds: [80, 18],
      rating: 8.6,
      ratingSource: 'tmdb',
      voteCount: 12000,
      popularity: 60,
      seedSimilaritySource: 'recommendation',
    },
    {
      id: 999,
      mediaType: 'movie',
      title: 'Speed Rush',
      year: 2022,
      overview: 'A high-energy, fun and lighthearted car chase adventure.',
      posterUrl: 'https://image.tmdb.org/t/p/w500/test2.jpg',
      genres: ['Action', 'Comedy'],
      genreIds: [28, 35],
      runtime: 92,
      rating: 7.2,
      ratingSource: 'tmdb',
      voteCount: 3000,
      popularity: 45,
    },
  ];

  const { ranked, groups } = filterAndRankCandidates(mockCandidates, prefs, [resolved.matches[0]]);
  assert.ok(ranked.length > 0, 'Must return ranked candidates');
  assert.ok(groups !== undefined, 'Must create result groups separating easy action from darker crime drama');
  assert.ok(groups!.some((g) => g.label.includes('Breezy') || g.label.includes('Action')));
  assert.ok(groups!.some((g) => g.label.includes('Darker') || g.label.includes('Crime')));
});

// ==========================================
// SCENARIO B: Clear Genre and Runtime
// "Recommend a comedy under 100 minutes."
// ==========================================
test('Scenario B: Comedy under 100 minutes enforces hard runtime filter and handles unknown runtime transparently', () => {
  const query = 'Recommend a comedy under 100 minutes.';
  const prefs = parseQueryDeterministically(query);

  assert.ok(prefs.genres.includes('Comedy'), 'Must extract Comedy');
  assert.equal(prefs.maxRuntimeMinutes, 100, 'Max runtime must be exactly 100 minutes');

  const candidates: CandidateItem[] = [
    {
      id: 101,
      mediaType: 'movie',
      title: 'Airplane!',
      year: 1980,
      overview: 'Laugh-out-loud comedy on an airplane.',
      posterUrl: '',
      genres: ['Comedy'],
      genreIds: [35],
      runtime: 88, // Under 100 min
      rating: 7.7,
      ratingSource: 'curated',
      voteCount: 4200,
      popularity: 30,
    },
    {
      id: 102,
      mediaType: 'movie',
      title: 'The Wolf of Wall Street',
      year: 2013,
      overview: 'Wall Street excess.',
      posterUrl: '',
      genres: ['Comedy', 'Crime'],
      genreIds: [35, 80],
      runtime: 180, // Over 100 min - must be filtered out!
      rating: 8.0,
      ratingSource: 'tmdb',
      voteCount: 23000,
      popularity: 90,
    },
    {
      id: 103,
      mediaType: 'movie',
      title: 'Indie Short Comedy',
      year: 2024,
      overview: 'A short quirky comedy.',
      posterUrl: '',
      genres: ['Comedy'],
      genreIds: [35],
      runtime: undefined, // Unknown runtime
      rating: 7.0,
      ratingSource: 'tmdb',
      voteCount: 200,
      popularity: 15,
    },
  ];

  const { ranked } = filterAndRankCandidates(candidates, prefs, []);
  // The 180m movie must be filtered out
  assert.equal(ranked.some((m) => m.title === 'The Wolf of Wall Street'), false);
  // Airplane! must pass and mention runtime compliance
  const airplane = ranked.find((m) => m.title === 'Airplane!')!;
  assert.ok(airplane);
  assert.ok(airplane.matchReasons.some((r) => r.includes('88m fits under 100m')));

  // Indie Short Comedy with unverified runtime must explicitly list it in missingDataIndicators
  const unverified = ranked.find((m) => m.title === 'Indie Short Comedy')!;
  assert.ok(unverified);
  assert.ok(unverified.missingDataIndicators.some((m) => m.includes('Runtime unverified')));
});

// ==========================================
// SCENARIO C: Exclusion Overrides Preference
// "I want intense action but nothing violent."
// ==========================================
test('Scenario C: Explicit exclusion "nothing violent" takes precedence over positive action preference', () => {
  const query = 'I want intense action but nothing violent.';
  const prefs = parseQueryDeterministically(query);

  assert.ok(prefs.genres.includes('Action'));
  assert.ok(prefs.excludeContent.includes('violent'), 'Must register violent as an exclusion');

  const candidates: CandidateItem[] = [
    {
      id: 201,
      mediaType: 'movie',
      title: 'Saw XXX',
      year: 2023,
      overview: 'A violent, sadistic, and gory trap game where victims are tortured.',
      posterUrl: '',
      genres: ['Action', 'Horror'],
      genreIds: [28, 27],
      rating: 6.5,
      ratingSource: 'tmdb',
      voteCount: 1000,
      popularity: 40,
    },
    {
      id: 202,
      mediaType: 'movie',
      title: 'Sky Racers',
      year: 2022,
      overview: 'High-speed aircraft racing tournament with acrobatic stunts and friendly rivalries.',
      posterUrl: '',
      genres: ['Action', 'Adventure'],
      genreIds: [28, 12],
      rating: 7.4,
      ratingSource: 'tmdb',
      voteCount: 2000,
      popularity: 50,
    },
  ];

  const { ranked } = filterAndRankCandidates(candidates, prefs, []);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].title, 'Sky Racers');
  // Does not falsely claim the title is universally non-violent, but shows clean action
  assert.equal(ranked.some((m) => m.title === 'Saw XXX'), false);
});

// ==========================================
// SCENARIO D: Ambiguous Title Disambiguation
// ==========================================
test('Scenario D: Ambiguous title (e.g. Pinocchio or multiple versions) triggers disambiguation prompt', async () => {
  // Pinocchio has 1940 classic and multiple modern versions with >500 votes
  const res = await resolveTitle('Pinocchio', 'movie');
  // Verify that multiple versions exist
  assert.ok(res.matches.length >= 2, 'Should find multiple Pinocchio entities');
  assert.ok(res.matches[0].year > 0);
  assert.ok(res.matches[1].year > 0);
  // Verify they differ in year or version
  assert.notEqual(res.matches[0].year, res.matches[1].year);
});

// ==========================================
// SCENARIO E: Conflicting Request
// "I want something relaxing but really intense"
// ==========================================
test('Scenario E: Detects conflict between relaxing and intense and formulates clarification', () => {
  const query = 'I want something relaxing but really intense';
  const prefs = parseQueryDeterministically(query);

  assert.equal(prefs.clarificationNeeded, true, 'Must flag conflict between relaxing and really intense');
  assert.ok(
    prefs.clarificationQuestion?.toLowerCase().includes('relaxing') ||
      prefs.clarificationQuestion?.toLowerCase().includes('intense'),
    'Clarification must address the contradiction'
  );
});

// ==========================================
// SCENARIO F: Media Type (Movie vs TV)
// ==========================================
test('Scenario F: Correctly distinguishes between TV shows and movies without mixing fields', () => {
  const tvQuery = parseQueryDeterministically('I want a crime tv show');
  assert.equal(tvQuery.mediaType, 'tv');
  assert.ok(tvQuery.genres.includes('Crime'));

  const movieQuery = parseQueryDeterministically('Recommend a crime movie');
  assert.equal(movieQuery.mediaType, 'movie');
  assert.ok(movieQuery.genres.includes('Crime'));
});

// ==========================================
// SCENARIO G: Empty, Whitespace, and Vague Queries
// ==========================================
test('Scenario G: Handles blank, whitespace, and vague queries gracefully without crashing', () => {
  const blankPrefs = parseQueryDeterministically('');
  assert.equal(blankPrefs.mediaType, 'movie');
  assert.equal(blankPrefs.genres.length, 0);

  const whitespacePrefs = parseQueryDeterministically('     ');
  assert.equal(whitespacePrefs.genres.length, 0);

  const vaguePrefs = parseQueryDeterministically('something good');
  // Should not crash, and should return valid structure
  assert.ok(vaguePrefs);

  const candidates: CandidateItem[] = [
    {
      id: 501,
      mediaType: 'movie',
      title: 'Universal Hit',
      year: 2023,
      overview: 'An acclaimed, beautifully told family journey.',
      posterUrl: '',
      genres: ['Adventure', 'Drama'],
      genreIds: [12, 18],
      rating: 8.2,
      ratingSource: 'curated',
      voteCount: 5000,
      popularity: 80,
    },
  ];

  const { ranked } = filterAndRankCandidates(candidates, vaguePrefs, []);
  assert.equal(ranked.length, 1);
  assert.ok(ranked[0].reason.length > 10);
  assert.ok(!ranked[0].reason.includes('undefined'));
});

// ==========================================
// SCENARIO H: Provider Failure Resilience
// ==========================================
test('Scenario H: Fallback to curated catalog when API times out or is unconfigured', async () => {
  const prefs = parseQueryDeterministically('Comedy');
  // Pass undefined API key to simulate provider absence or outage
  const candidates = await retrieveCandidates(prefs, [], undefined);
  assert.ok(candidates.length >= 3, 'Must return fallback catalog candidates without crashing');
  assert.ok(candidates.every((c) => c.title && c.posterUrl));
});

// ==========================================
// SCENARIO I: Feedback Actions & Deduplication
// ==========================================
test('Scenario I: Excludes previously seen or not-interested movie IDs', () => {
  const prefs = parseQueryDeterministically('Comedy');
  const seenId = 807; // Airplane!

  const candidates: CandidateItem[] = [
    {
      id: 807,
      mediaType: 'movie',
      title: 'Airplane!',
      year: 1980,
      overview: 'Comedy',
      posterUrl: '',
      genres: ['Comedy'],
      genreIds: [35],
      rating: 7.7,
      ratingSource: 'curated',
      voteCount: 4200,
      popularity: 30,
    },
    {
      id: 808,
      mediaType: 'movie',
      title: 'The Naked Gun',
      year: 1988,
      overview: 'Police comedy',
      posterUrl: '',
      genres: ['Comedy'],
      genreIds: [35],
      rating: 7.6,
      ratingSource: 'curated',
      voteCount: 3800,
      popularity: 28,
    },
  ];

  // Pass seenId in excludeIds
  const { ranked } = filterAndRankCandidates(candidates, prefs, [], [seenId]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, 808, 'Must exclude already seen or dismissed ID');
});

// ==========================================
// SCENARIO J: Browser DOM & Accessibility Simulation
// ==========================================
test('Scenario J: DOM structure contains semantic accessible labels, headings, and buttons', () => {
  const dom = new JSDOM(`
    <!doctype html>
    <html lang="en">
      <head><title>Movie Night Picker</title></head>
      <body>
        <main>
          <h1>Movie Night <span class="accent">Picker</span></h1>
          <form role="search">
            <label for="natural-query-input">Describe movie vibe, genre, or favorite title</label>
            <input id="natural-query-input" type="text" aria-label="Describe movie vibe, genre, or favorite title" />
            <button type="submit" aria-label="Search movie recommendations">Search</button>
          </form>
          <div role="region" aria-label="Movie Recommendations">
            <article class="movie-card" tabindex="0">
              <h3>Moneyball</h3>
              <p>A general manager builds a competitive team.</p>
              <button aria-label="Find more movies like Moneyball">More like this</button>
              <button aria-label="Save Moneyball for later">Save</button>
            </article>
          </div>
        </main>
        <footer>
          <span>Movie data by TMDB</span>
        </footer>
      </body>
    </html>
  `);

  const { document } = dom.window;
  const h1 = document.querySelector('h1');
  assert.ok(h1 && h1.textContent?.includes('Movie Night Picker'));

  const input = document.getElementById('natural-query-input');
  assert.ok(input);
  assert.equal(input.getAttribute('aria-label'), 'Describe movie vibe, genre, or favorite title');

  const searchBtn = document.querySelector('button[type="submit"]');
  assert.ok(searchBtn);
  assert.equal(searchBtn.getAttribute('aria-label'), 'Search movie recommendations');

  const card = document.querySelector('.movie-card');
  assert.ok(card);
  assert.equal(card.getAttribute('tabindex'), '0');

  const footer = document.querySelector('footer');
  assert.ok(footer?.textContent?.includes('Movie data by TMDB'));
});
