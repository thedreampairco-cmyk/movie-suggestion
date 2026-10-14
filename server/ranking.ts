import {
  CandidateItem,
  ParsedPreferences,
  RankedMovie,
  ResolvedTitle,
  ResultGroup,
  ScoreBreakdown,
} from './types.js';

const GENRE_NAME_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  27: 'Horror',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  53: 'Thriller',
  10759: 'Action & Adventure',
  10765: 'Sci-Fi & Fantasy',
};

/**
 * Bayesian confidence rating formula:
 * (v / (v + m)) * R + (m / (v + m)) * C
 * where v = voteCount, m = minimum votes (250), C = prior mean (6.5), R = rating
 */
function calculateConfidenceRating(rating: number, voteCount: number): number {
  const m = 250;
  const C = 6.5;
  const v = Math.min(voteCount, 15000);
  const bayesian = (v / (v + m)) * rating + (m / (v + m)) * C;
  return Math.max(0, Math.min(10, bayesian));
}

/**
 * Filter and Rank Candidates
 */
export function filterAndRankCandidates(
  candidates: CandidateItem[],
  prefs: ParsedPreferences,
  resolvedSeeds: ResolvedTitle[],
  excludeIds: number[] = []
): { ranked: RankedMovie[]; groups?: ResultGroup[] } {
  const excludeSet = new Set(excludeIds);
  const dislikedSet = new Set(prefs.dislikedTitles.map((t) => t.toLowerCase()));

  // 1. HARD FILTERS
  const filtered = candidates.filter((item) => {
    // Exclude by ID
    if (excludeSet.has(item.id)) return false;

    // Disliked title match
    if (dislikedSet.has(item.title.toLowerCase())) return false;

    // Media type filter
    if (prefs.mediaType !== 'all' && item.mediaType !== prefs.mediaType) {
      return false;
    }

    // Excluded genres
    const itemGenreNames = item.genres.length > 0
      ? item.genres
      : item.genreIds.map((id) => GENRE_NAME_MAP[id]).filter(Boolean);

    for (const ex of prefs.excludeGenres) {
      if (itemGenreNames.some((g) => g.toLowerCase() === ex.toLowerCase())) {
        return false;
      }
    }

    // Excluded content (e.g. violent, jump scares, gore)
    if (prefs.excludeContent.length > 0) {
      const overviewLower = (item.overview || '').toLowerCase();
      if (prefs.excludeContent.includes('violent')) {
        // If user wants no violence, eliminate gory/brutal films
        if (
          overviewLower.includes('violent') ||
          overviewLower.includes('brutal') ||
          overviewLower.includes('gory') ||
          overviewLower.includes('bloody massacre') ||
          overviewLower.includes('sadistic')
        ) {
          return false;
        }
      }
      if (prefs.excludeContent.includes('jump scares') || prefs.excludeContent.includes('gore')) {
        if (itemGenreNames.includes('Horror') || overviewLower.includes('gore')) {
          return false;
        }
      }
    }

    // Max runtime filter (when runtime is known)
    if (prefs.maxRuntimeMinutes && item.runtime && item.runtime > prefs.maxRuntimeMinutes) {
      return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    return { ranked: [] };
  }

  // Determine available signals for dynamic weight redistribution
  const searchKeywords = prefs.searchKeywords || [];
  const semanticThemes = prefs.semanticThemes || [];
  const hasKeywordPref = searchKeywords.length > 0;
  const hasGenrePref = prefs.genres.length > 0;
  const hasSeedPref = resolvedSeeds.length > 0;
  const hasMoodOrEffort =
    prefs.mood.length > 0 || prefs.watchEffort !== null || prefs.intensity !== null;
  const hasConstraint = prefs.maxRuntimeMinutes !== null || prefs.language !== null;

  // Base raw weights - keywords get high priority when provided
  let wKeyword = hasKeywordPref ? 40 : 0;
  let wGenre = hasGenrePref ? (hasKeywordPref ? 20 : 30) : 0;
  let wSeed = hasSeedPref ? (hasKeywordPref ? 15 : 25) : 0;
  let wMood = hasMoodOrEffort ? (hasKeywordPref ? 10 : 20) : 0;
  let wConstraint = hasConstraint ? 10 : 0;
  let wQuality = 10;
  let wDiversity = 5;

  const totalRawWeight = wKeyword + wGenre + wSeed + wMood + wConstraint + wQuality + wDiversity;
  // Normalization multiplier
  const normFactor = 100 / (totalRawWeight || 1);

  // Franchise repetition tracking for diversity
  const franchiseCount = new Map<string, number>();

  // Check if any candidates in the pool have a keyword match
  const anyKeywordMatchesExist = hasKeywordPref && filtered.some((item) => {
    if (item.keywordMatched) return true;
    const titleL = item.title.toLowerCase();
    const ovL = (item.overview || '').toLowerCase();
    return searchKeywords.some((kw) => titleL.includes(kw.toLowerCase()) || ovL.includes(kw.toLowerCase()));
  });

  // 2. SCORING EACH CANDIDATE
  const scoredItems: RankedMovie[] = filtered.map((item) => {
    const reasons: string[] = [];
    const missingData: string[] = [];

    const itemGenreNames = item.genres.length > 0
      ? item.genres
      : item.genreIds.map((id) => GENRE_NAME_MAP[id]).filter(Boolean);

    // Populate item genres if missing
    item.genres = itemGenreNames;

    // Detect missing data
    if (!item.runtime) {
      missingData.push('Runtime unverified');
    }
    if (!item.overview || item.overview.trim().length === 0) {
      missingData.push('Plot overview unlisted');
    }
    if (itemGenreNames.length === 0) {
      missingData.push('Genre tags unlisted');
    }

    const titleLower = item.title.toLowerCase();
    const overviewLower = (item.overview || '').toLowerCase();

    // Component K: Keyword & Semantic Relevance Match (0 - 40)
    let keywordScore = 0;
    if (hasKeywordPref) {
      let matchedInTitle: string | null = null;
      let matchedInOverview: string | null = null;
      let matchedInTheme: string | null = null;

      // Check primary keywords
      for (const kw of searchKeywords) {
        const kwL = kw.toLowerCase().trim();
        if (!kwL) continue;

        const kwWordRegex = new RegExp(`\\b${kwL}\\b`, 'i');
        if (kwWordRegex.test(titleLower) || titleLower.includes(kwL)) {
          matchedInTitle = kw;
          break;
        } else if (kwWordRegex.test(overviewLower) || overviewLower.includes(kwL)) {
          matchedInOverview = kw;
          break;
        }
      }

      // Check semantic themes if no primary match in title
      if (!matchedInTitle) {
        for (const th of semanticThemes) {
          const thL = th.toLowerCase().trim();
          if (!thL) continue;
          const thWordRegex = new RegExp(`\\b${thL}\\b`, 'i');
          if (thWordRegex.test(titleLower)) {
            matchedInTheme = th;
            break;
          } else if (thWordRegex.test(overviewLower)) {
            matchedInTheme = th;
            break;
          }
        }
      }

      if (matchedInTitle) {
        keywordScore = 40;
        reasons.push(`Directly matches your search for "${matchedInTitle}" (featured in title and storyline)`);
      } else if (matchedInOverview) {
        keywordScore = 32;
        reasons.push(`Directly matches your search for "${matchedInOverview}" in the storyline`);
      } else if (matchedInTheme) {
        keywordScore = 24;
        reasons.push(`Explores themes of ${matchedInTheme} related to your search`);
      } else if (item.keywordMatched || item.seedSimilaritySource === 'keyword') {
        keywordScore = 14;
        const term = item.matchedKeywords?.[0] || searchKeywords[0];
        reasons.push(`Thematically related to "${term}"`);
      } else {
        keywordScore = 0;
      }
    }

    // Component A: Genre Match (0 - 30)
    let genreScore = 0;
    if (hasGenrePref) {
      const matchCount = itemGenreNames.filter((g) =>
        prefs.genres.some((pg) => pg.toLowerCase() === g.toLowerCase())
      ).length;
      const ratio = matchCount / Math.max(1, prefs.genres.length);
      genreScore = Math.min(30, ratio * 30);
      if (matchCount > 0) {
        reasons.push(`Matches requested genre: ${itemGenreNames.filter(g => prefs.genres.includes(g)).join(', ')}`);
      }
    }

    // Component B: Seed / Liked Title Similarity (0 - 25)
    let seedScore = 0;
    if (hasSeedPref) {
      if (item.seedSimilaritySource === 'recommendation') {
        seedScore = 25;
        reasons.push(`Direct recommendation for fans of ${resolvedSeeds[0].title}`);
      } else if (item.seedSimilaritySource === 'similar') {
        seedScore = 20;
        reasons.push(`Shares story structure with ${resolvedSeeds[0].title}`);
      } else {
        const seedGenres = resolvedSeeds[0].genres || ['Crime', 'Drama'];
        const overlap = itemGenreNames.filter((g) => seedGenres.includes(g)).length;
        seedScore = overlap >= 2 ? 16 : overlap === 1 ? 10 : 4;
        if (overlap > 0) {
          reasons.push(`Shares thematic tones with ${resolvedSeeds[0].title}`);
        }
      }
    }

    // Component C: Mood / Intensity / Watch-effort Match (0 - 20)
    let moodScore = 0;
    if (hasMoodOrEffort) {
      // Watch effort alignment
      if (prefs.watchEffort === 'low') {
        if (itemGenreNames.includes('Comedy') || itemGenreNames.includes('Animation') || (item.runtime && item.runtime <= 95)) {
          moodScore += 10;
          reasons.push('Light pacing suited for an easy, low-effort watch');
        } else if (itemGenreNames.includes('Action') && !overviewLower.includes('complex')) {
          moodScore += 8;
          reasons.push('Fast-paced action suitable when feeling tired');
        } else {
          moodScore += 4;
        }
      } else if (prefs.watchEffort === 'high') {
        if (itemGenreNames.includes('Mystery') || itemGenreNames.includes('Drama') || (item.runtime && item.runtime >= 120)) {
          moodScore += 10;
        }
      } else {
        moodScore += 6;
      }

      // Intensity alignment
      if (prefs.intensity === 'high') {
        if (itemGenreNames.includes('Action') || itemGenreNames.includes('Thriller') || itemGenreNames.includes('Crime')) {
          moodScore += 10;
          reasons.push('Delivers high-stakes adrenaline and tension');
        } else {
          moodScore += 4;
        }
      } else if (prefs.intensity === 'low') {
        if (!itemGenreNames.includes('Horror') && !itemGenreNames.includes('Thriller')) {
          moodScore += 10;
          reasons.push('Gentle and uplifting tone without harsh tension');
        }
      } else {
        moodScore += 5;
      }

      moodScore = Math.min(20, moodScore);
    }

    // Component D: Runtime and Practical Constraints (0 - 10)
    let constraintScore = 0;
    if (hasConstraint) {
      let runtimeOk = true;
      if (prefs.maxRuntimeMinutes && item.runtime) {
        runtimeOk = item.runtime <= prefs.maxRuntimeMinutes;
        if (runtimeOk) {
          constraintScore += 10;
          reasons.push(`Runtime of ${item.runtime}m fits under ${prefs.maxRuntimeMinutes}m limit`);
        }
      } else if (!item.runtime) {
        constraintScore += 5;
        missingData.push('Runtime not verified in database');
      } else {
        constraintScore += 7;
      }
    } else {
      constraintScore = 8;
    }

    // Component E: Quality / Confidence Score (0 - 10)
    const confidenceRating = calculateConfidenceRating(item.rating, item.voteCount);
    const qualityScore = Math.min(10, (confidenceRating / 10) * 10);
    if (item.rating >= 7.5 && item.voteCount >= 500) {
      reasons.push(`Strong critical rating: ${item.rating}/10 (${item.voteCount.toLocaleString()} votes)`);
    }

    // Component F: Diversity Adjustment (0 - 5)
    const franchiseKey = item.title.split(/[:\-\d]/)[0].trim().toLowerCase();
    const count = franchiseCount.get(franchiseKey) || 0;
    let diversityScore = 5;
    if (count > 0) {
      diversityScore = Math.max(0, 5 - count * 2);
    }
    franchiseCount.set(franchiseKey, count + 1);

    // Compute normalized total score (0 - 100) using true weighted sum
    const weightedSum =
      (keywordScore / 40) * wKeyword +
      (genreScore / 30) * wGenre +
      (seedScore / 25) * wSeed +
      (moodScore / 20) * wMood +
      (constraintScore / 10) * wConstraint +
      (qualityScore / 10) * wQuality +
      (diversityScore / 5) * wDiversity;

    let normalizedTotal = Math.round((weightedSum / (totalRawWeight || 1)) * 100);

    // RELEVANCE SANITY GUARD:
    // If the user performed a keyword search (e.g. "money") and we found matching items,
    // candidates with 0 keyword relevance must NOT outrank actual matches!
    if (anyKeywordMatchesExist && keywordScore === 0) {
      normalizedTotal = Math.min(30, normalizedTotal);
    }

    const breakdown: ScoreBreakdown = {
      keywordMatch: hasKeywordPref ? Math.round(keywordScore) : undefined,
      genreMatch: Math.round(genreScore),
      titleSimilarity: Math.round(seedScore),
      moodAndEffort: Math.round(moodScore),
      constraints: Math.round(constraintScore),
      qualityConfidence: Math.round(qualityScore),
      diversityBonus: Math.round(diversityScore),
      totalScore: normalizedTotal,
    };

    // Assemble clean explanation sentence
    let explanation = reasons.slice(0, 2).join('. ') + '.';
    if (explanation.length < 5) {
      const genreLabel = itemGenreNames.length > 0 ? `your ${itemGenreNames.slice(0, 2).join(' & ')} preferences` : 'exceptional storytelling';
      explanation = `Selected based on ${genreLabel} and high viewer ratings.`;
    }

    // Is hidden gem: rating >= 7.0 and voteCount between 100 and 2500
    const isHiddenGem = item.rating >= 7.0 && item.voteCount >= 100 && item.voteCount <= 2500;

    return {
      ...item,
      matchScore: normalizedTotal,
      scoreBreakdown: breakdown,
      matchReasons: reasons,
      missingDataIndicators: missingData,
      reason: explanation,
      isHiddenGem,
    };
  });

  // Sort: Keyword relevance first when searching by keyword, then matchScore, then quality
  scoredItems.sort((a, b) => {
    if (hasKeywordPref) {
      const aKw = a.scoreBreakdown.keywordMatch || 0;
      const bKw = b.scoreBreakdown.keywordMatch || 0;
      if (aKw !== bKw) {
        return bKw - aKw;
      }
    }
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    const aRating = a.rating * Math.log10(Math.max(10, a.voteCount));
    const bRating = b.rating * Math.log10(Math.max(10, b.voteCount));
    return bRating - aRating;
  });

  // Grouping logic for queries
  let groups: ResultGroup[] | undefined;

  // Grouping for keyword queries (e.g. "money")
  if (hasKeywordPref && scoredItems.length >= 3) {
    const kw = searchKeywords[0];
    const directMatches = scoredItems.filter((m) => (m.scoreBreakdown.keywordMatch || 0) >= 30);
    const thematicMatches = scoredItems.filter(
      (m) => (m.scoreBreakdown.keywordMatch || 0) >= 12 && (m.scoreBreakdown.keywordMatch || 0) < 30
    );

    if (directMatches.length > 0 && thematicMatches.length > 0) {
      groups = [
        {
          label: `Direct ${kw.charAt(0).toUpperCase() + kw.slice(1)} Picks`,
          description: `Stories centered directly on ${kw} and primary plot events.`,
          movies: directMatches.slice(0, 3),
        },
        {
          label: `Thematic & Related Stories`,
          description: `Engaging stories sharing related high-stakes themes and concepts.`,
          movies: thematicMatches.slice(0, 3),
        },
      ];
    }
  } else if (prefs.clarificationNeeded || (prefs.watchEffort === 'low' && prefs.genres.includes('Action'))) {
    const easyWatch = scoredItems.filter((m) =>
      m.genres.includes('Comedy') || m.genres.includes('Adventure') || (m.runtime && m.runtime <= 110)
    );
    const intenseWatch = scoredItems.filter((m) =>
      m.genres.includes('Crime') || m.genres.includes('Thriller') || m.genres.includes('Drama')
    );

    if (easyWatch.length > 0 && intenseWatch.length > 0) {
      groups = [
        {
          label: 'Breezy / Easy-to-Follow Action',
          description: 'Fun, accessible pacing designed for unwinding when you are tired.',
          movies: easyWatch.slice(0, 3),
        },
        {
          label: 'Darker / Intense Crime & Action',
          description: 'Richer storylines and high-stakes drama in the vein of classic crime epics.',
          movies: intenseWatch.slice(0, 3),
        },
      ];
    }
  }

  return {
    ranked: scoredItems,
    groups,
  };
}
