import { GoogleGenAI, Type } from '@google/genai';
import { ParsedPreferences, Intensity, WatchEffort, MediaType } from './types.js';

export const KNOWN_GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'Horror',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Thriller',
] as const;

export const KNOWN_LANGUAGES: Record<string, string> = {
  english: 'en',
  hindi: 'hi',
  tamil: 'ta',
  telugu: 'te',
  korean: 'ko',
  japanese: 'ja',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
};

/**
 * Deterministic query parser fallback using keywords, regex and rule evaluation
 */
export function parseQueryDeterministically(
  text: string,
  structuredInputs?: Partial<ParsedPreferences>
): ParsedPreferences {
  const normalizedText = (text || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
  const lower = normalizedText.toLowerCase().trim();

  // 1. Media Type
  let mediaType: MediaType = 'movie';
  if (lower.includes('tv show') || lower.includes('tv series') || lower.includes('television') || lower.includes('series')) {
    mediaType = 'tv';
  } else if (lower.includes('show or movie') || lower.includes('movie or show') || lower.includes('anything')) {
    mediaType = 'all';
  }

  // 2. Watch Effort & Intensity
  let watchEffort: WatchEffort | null = null;
  if (
    lower.includes('tired') ||
    lower.includes('exhausted') ||
    lower.includes('low effort') ||
    lower.includes('easy watch') ||
    lower.includes('turn off my brain') ||
    lower.includes('light') ||
    lower.includes('breezy')
  ) {
    watchEffort = 'low';
  } else if (lower.includes('deep dive') || lower.includes('complex') || lower.includes('intellectual')) {
    watchEffort = 'high';
  }

  let intensity: Intensity | null = null;
  if (
    lower.includes('intense') ||
    lower.includes('adrenaline') ||
    lower.includes('edge of my seat') ||
    lower.includes('heart-pounding') ||
    lower.includes('thrilling') ||
    lower.includes('dark')
  ) {
    intensity = 'high';
  } else if (
    lower.includes('gentle') ||
    lower.includes('calm') ||
    lower.includes('lighthearted') ||
    lower.includes('peaceful') ||
    lower.includes('light ') ||
    lower.includes('light comedy')
  ) {
    intensity = 'low';
  }

  // 3. Moods
  const moodList: string[] = [];
  const moodMap: Record<string, string> = {
    tired: 'tired',
    relaxed: 'relaxed',
    relaxing: 'relaxed',
    chill: 'relaxed',
    stress: 'stressed',
    stressed: 'stressed',
    romantic: 'romantic',
    romance: 'romantic',
    adventurous: 'adventurous',
    adventure: 'adventurous',
    curious: 'curious',
    sad: 'sad',
    depressed: 'sad',
    happy: 'happy',
    upbeat: 'happy',
    comfort: 'comforting',
    comforting: 'comforting',
    'feel-good': 'feel-good',
    'feel good': 'feel-good',
  };

  for (const [key, value] of Object.entries(moodMap)) {
    if (lower.includes(key) && !moodList.includes(value)) {
      moodList.push(value);
    }
  }

  // 4. Genres and Exclusions
  const genres: string[] = [];
  const excludeGenres: string[] = [];

  // Excluded genre patterns: "no horror", "not horror", "avoid horror", "without horror"
  for (const g of KNOWN_GENRES) {
    const gLower = g.toLowerCase();
    const negPatterns = [
      `no ${gLower}`,
      `not ${gLower}`,
      `avoid ${gLower}`,
      `without ${gLower}`,
      `exclude ${gLower}`,
      `hate ${gLower}`,
      `dislike ${gLower}`,
    ];

    if (negPatterns.some((pattern) => lower.includes(pattern))) {
      excludeGenres.push(g);
    } else if (lower.includes(gLower)) {
      genres.push(g);
    }
  }

  // Check Sci-Fi aliases
  if (lower.includes('sci fi') || lower.includes('science fiction') || lower.includes('scifi')) {
    if (!genres.includes('Sci-Fi')) genres.push('Sci-Fi');
  }

  // 5. Excluded Content (e.g. violent, jump scares, gore)
  const excludeContent: string[] = [];
  if (
    lower.includes('nothing violent') ||
    lower.includes('not violent') ||
    lower.includes('no violence') ||
    lower.includes('non violent') ||
    lower.includes('non-violent') ||
    lower.includes('without violence')
  ) {
    excludeContent.push('violent');
  }
  if (lower.includes('no jump scares') || lower.includes('no jumpscares') || lower.includes('avoid jump scares')) {
    excludeContent.push('jump scares');
  }
  if (lower.includes('no gore') || lower.includes('not gory') || lower.includes('avoid gore')) {
    excludeContent.push('gore');
  }

  // 6. Max Runtime
  let maxRuntimeMinutes: number | null = null;
  const runtimeMinMatch = lower.match(/under\s+(\d+)\s*(?:min|mins|minutes)?/i) ||
    lower.match(/less\s+than\s+(\d+)\s*(?:min|mins|minutes)?/i) ||
    lower.match(/within\s+(\d+)\s*(?:min|mins|minutes)?/i);

  if (runtimeMinMatch) {
    const parsed = parseInt(runtimeMinMatch[1], 10);
    // If user says "under 2" without "min", it's probably 2 hours
    if (parsed <= 4) {
      maxRuntimeMinutes = parsed * 60;
    } else if (parsed >= 40 && parsed <= 360) {
      maxRuntimeMinutes = parsed;
    }
  }

  const hourMatch = lower.match(/under\s+(\d+(?:\.\d+)?)\s*(?:hour|hours|hrs|hr|h)/i) ||
    lower.match(/less\s+than\s+(\d+(?:\.\d+)?)\s*(?:hour|hours|hrs|hr|h)/i);
  if (hourMatch) {
    maxRuntimeMinutes = Math.round(parseFloat(hourMatch[1]) * 60);
  }

  // 7. Liked & Disliked Titles Extraction
  const likedTitles: string[] = [];
  const dislikedTitles: string[] = [];

  // Patterns like: "like The Godfather", "loved Inception", "similar to Interstellar"
  const titlePatterns = [
    /(?:i like|like|liked|love|loved|similar to|fan of|in the vein of)\s+([A-Z0-9][a-zA-Z0-9\s:,'-]{2,40})/gi,
    /(?:favorite movie is|favourite is)\s+([A-Z0-9][a-zA-Z0-9\s:,'-]{2,40})/gi,
  ];

  for (const pattern of titlePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let candidate = match[1].trim();
      // Clean trailing punctuation or conjunctions
      candidate = candidate.replace(/\s+(?:and|or|but|with|without|in|under|so).*$/i, '').trim();
      if (candidate.length > 2 && !likedTitles.includes(candidate)) {
        likedTitles.push(candidate);
      }
    }
  }

  // Special case check for famous titles mentioned verbatim
  const commonSeeds = [
    'The Godfather',
    'Inception',
    'The Dark Knight',
    'Interstellar',
    'Pulp Fiction',
    'Goodfellas',
    'Knives Out',
    'Parasite',
    'Fight Club',
    'The Matrix',
    'Gladiator',
    'Spirited Away',
    'Toy Story',
    'Before Sunrise',
  ];
  for (const seed of commonSeeds) {
    if (new RegExp(`\\b${seed}\\b`, 'i').test(text) && !likedTitles.includes(seed)) {
      likedTitles.push(seed);
    }
  }

  // Disliked titles pattern
  const dislikePatterns = [
    /(?:dislike|hate|hated|don't like|dont like|avoid)\s+([A-Z0-9][a-zA-Z0-9\s:,'-]{2,40})/gi,
  ];
  for (const pattern of dislikePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let candidate = match[1].trim().replace(/\s+(?:and|or|but).*$/i, '').trim();
      if (candidate.length > 2 && !dislikedTitles.includes(candidate)) {
        dislikedTitles.push(candidate);
      }
    }
  }

  // 8. Topic & Keyword Concept Dictionary & Semantic Themes
  const CONCEPT_THEMES: Record<string, string[]> = {
    money: ['money', 'wealth', 'cash', 'heist', 'wall street', 'finance', 'robbery', 'bank', 'greed', 'stockbroker', 'rich', 'counterfeit', 'investor', 'financial'],
    heist: ['heist', 'robbery', 'bank', 'vault', 'thief', 'steal', 'con artist', 'caper', 'loot', 'safecracker'],
    'wall street': ['wall street', 'stockbroker', 'finance', 'stocks', 'trading', 'investment', 'money', 'wealth', 'greed', 'corporate'],
    space: ['space', 'astronaut', 'galaxy', 'sci-fi', 'spaceship', 'alien', 'cosmos', 'orbit', 'mars', 'interstellar'],
    zombie: ['zombie', 'undead', 'infection', 'outbreak', 'apocalypse', 'virus', 'survival'],
    'time travel': ['time travel', 'timeline', 'temporal', 'time loop', 'future', 'past', 'paradox'],
    superhero: ['superhero', 'powers', 'vigilante', 'comic', 'villain', 'avenger', 'mutant'],
    courtroom: ['courtroom', 'lawyer', 'trial', 'judge', 'legal', 'jury', 'justice', 'defense'],
    sports: ['sports', 'athlete', 'championship', 'coach', 'boxing', 'baseball', 'football', 'racing', 'underdog'],
    detective: ['detective', 'murder', 'investigation', 'clue', 'whodunit', 'mystery', 'sleuth', 'sherlock', 'killer'],
    spy: ['spy', 'espionage', 'secret agent', 'cia', 'assassin', 'undercover', 'mi6', 'intelligence'],
    wedding: ['wedding', 'marriage', 'bride', 'groom', 'matrimony', 'vows', 'romance'],
    survival: ['survival', 'stranded', 'wilderness', 'island', 'desert', 'lost', 'shipwreck'],
    prison: ['prison', 'jail', 'escape', 'inmate', 'convict', 'cell', 'warden'],
    cooking: ['cooking', 'chef', 'food', 'restaurant', 'culinary', 'baking', 'kitchen', 'gourmet'],
    dog: ['dog', 'canine', 'puppy', 'pet', 'animal', 'loyal dog'],
    war: ['war', 'battle', 'soldier', 'combat', 'military', 'army', 'wwii', 'frontline'],
    magic: ['magic', 'wizard', 'sorcerer', 'witch', 'spell', 'supernatural', 'enchanted'],
    cyberpunk: ['cyberpunk', 'hacker', 'android', 'cyborg', 'futuristic', 'dystopia', 'ai'],
    vampire: ['vampire', 'dracula', 'blood', 'undead', 'gothic', 'immortal'],
  };

  // Known multi-word compound phrases to preserve intact
  const COMPOUND_PHRASES = [
    'wall street',
    'time travel',
    'bank heist',
    'money laundering',
    'serial killer',
    'cold war',
    'martial arts',
    'space exploration',
    'artificial intelligence',
    'virtual reality',
    'organized crime',
  ];

  const searchKeywords: string[] = [];
  const semanticThemes: string[] = [];

  // Check compound phrases first
  for (const phrase of COMPOUND_PHRASES) {
    if (lower.includes(phrase)) {
      searchKeywords.push(phrase);
      if (CONCEPT_THEMES[phrase]) {
        semanticThemes.push(...CONCEPT_THEMES[phrase]);
      }
    }
  }

  // Remove common conversational filler from query to isolate topics
  const CONVERSATIONAL_FILLERS = [
    /^(?:i\s+want|i'm\s+looking\s+for|im\s+looking\s+for|can\s+you\s+give\s+me|give\s+me|recommend|suggest|show\s+me|find\s+me|search\s+for)\s+/gi,
    /\b(?:movie\s+about|movies\s+about|film\s+about|films\s+about|show\s+about|shows\s+about|story\s+about|stories\s+about)\b/gi,
    /\b(?:something\s+about|anything\s+about|a\s+movie\s+with|movies\s+with|films\s+with)\b/gi,
  ];

  let cleanedText = lower;
  for (const filler of CONVERSATIONAL_FILLERS) {
    cleanedText = cleanedText.replace(filler, ' ');
  }

  // Check known concept keys
  for (const [conceptKey, themes] of Object.entries(CONCEPT_THEMES)) {
    const rx = new RegExp(`\\b${conceptKey}\\b`, 'i');
    if (rx.test(cleanedText)) {
      if (!searchKeywords.includes(conceptKey)) {
        searchKeywords.push(conceptKey);
      }
      for (const t of themes) {
        if (!semanticThemes.includes(t)) {
          semanticThemes.push(t);
        }
      }
    }
  }

  // Stop words to strip before general token extraction
  const STOP_WORDS = new Set([
    'i', 'im', "i'm", 'want', 'a', 'an', 'the', 'movie', 'movies', 'film', 'films',
    'show', 'shows', 'tv', 'watch', 'watching', 'about', 'with', 'and', 'or', 'to',
    'for', 'me', 'some', 'something', 'good', 'best', 'give', 'suggest', 'recommend',
    'pick', 'tonight', 'like', 'in', 'of', 'on', 'is', 'it', 'my', 'please', 'just',
    'any', 'looking', 'see', 'need', 'can', 'you', 'really', 'would', 'type', 'types',
    'where', 'which', 'that', 'this', 'there', 'what', 'who', 'how', 'when'
  ]);

  let stripped = cleanedText;
  for (const g of KNOWN_GENRES) {
    stripped = stripped.replace(new RegExp(`\\b${g.toLowerCase()}\\b`, 'g'), ' ');
  }
  for (const k of Object.keys(moodMap)) {
    stripped = stripped.replace(new RegExp(`\\b${k}\\b`, 'g'), ' ');
  }
  for (const lt of likedTitles) {
    stripped = stripped.replace(new RegExp(`\\b${lt.toLowerCase()}\\b`, 'g'), ' ');
  }
  stripped = stripped.replace(/under\s+\d+\s*(?:min|mins|minutes|hours|hrs|hr|h)?/g, ' ');
  stripped = stripped.replace(/less\s+than\s+\d+\s*(?:min|mins|minutes|hours|hrs|hr|h)?/g, ' ');

  const rawKeywords = stripped
    .split(/[^a-zA-Z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  for (const kw of rawKeywords) {
    if (!searchKeywords.includes(kw)) {
      searchKeywords.push(kw);
      if (!semanticThemes.includes(kw)) {
        semanticThemes.push(kw);
      }
    }
  }

  // If the query was 1-2 words and still nothing in searchKeywords, preserve original query
  if (searchKeywords.length === 0 && text.trim().length > 1 && !STOP_WORDS.has(lower)) {
    searchKeywords.push(text.trim());
    semanticThemes.push(text.trim());
  }

  // 9. Language extraction
  let language: string | null = null;
  for (const [langName, code] of Object.entries(KNOWN_LANGUAGES)) {
    if (lower.includes(langName) || lower.includes(`${langName} language`)) {
      language = code;
      break;
    }
  }

  // 10. Conflict / Clarification Detection
  let clarificationNeeded = false;
  let clarificationQuestion: string | null = null;

  // Conflict 1: User is tired/wants low watch effort, but also wants an action movie and likes an intense movie like The Godfather
  if (watchEffort === 'low' && genres.includes('Action') && likedTitles.length > 0) {
    clarificationNeeded = true;
    clarificationQuestion = `When you say tired, do you want easy-to-follow action or something richer and more intense like ${likedTitles[0]}?`;
  } else if (
    (watchEffort === 'low' || moodList.includes('relaxed') || moodList.includes('tired')) &&
    intensity === 'high'
  ) {
    clarificationNeeded = true;
    clarificationQuestion =
      'You asked for something relaxing while also wanting high intensity. Would you prefer a breezy thriller or a darker, high-stakes story?';
  }

  // 11. Merge with Structured Form Inputs (Explicit structured inputs take precedence)
  const finalPrefs: ParsedPreferences = {
    mediaType: structuredInputs?.mediaType || mediaType,
    mood: structuredInputs?.mood && structuredInputs.mood.length > 0 ? structuredInputs.mood : moodList,
    genres: structuredInputs?.genres && structuredInputs.genres.length > 0 ? structuredInputs.genres : genres,
    likedTitles: structuredInputs?.likedTitles || likedTitles,
    dislikedTitles: structuredInputs?.dislikedTitles || dislikedTitles,
    mustInclude: structuredInputs?.mustInclude || [],
    excludeGenres: structuredInputs?.excludeGenres || excludeGenres,
    excludeContent: structuredInputs?.excludeContent || excludeContent,
    language: structuredInputs?.language || language,
    region: structuredInputs?.region || 'IN',
    maxRuntimeMinutes: structuredInputs?.maxRuntimeMinutes ?? maxRuntimeMinutes,
    releasePeriod: structuredInputs?.releasePeriod || null,
    intensity: structuredInputs?.intensity || intensity,
    watchEffort: structuredInputs?.watchEffort || watchEffort,
    searchKeywords: structuredInputs?.searchKeywords && structuredInputs.searchKeywords.length > 0 ? structuredInputs.searchKeywords : searchKeywords,
    semanticThemes: Array.from(new Set(semanticThemes)),
    rawQuery: text.trim(),
    clarificationNeeded,
    clarificationQuestion,
  };

  return finalPrefs;
}

/**
 * Parse user query using Gemini AI (with fallback to deterministic parser)
 */
export async function parseUserQuery(
  text: string,
  structuredInputs?: Partial<ParsedPreferences>
): Promise<ParsedPreferences> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text || text.trim().length === 0) {
    return parseQueryDeterministically(text || '', structuredInputs);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Parse the following user movie/TV search query into a structured preference object.
User Query: "${text}"

Rules:
1. Extract topic, concept, subject, and storyline keywords into searchKeywords (e.g. for "money" -> ["money"], for "movie about money and wall street" -> ["money", "wall street"], for "heist movie" -> ["heist"], for "time travel romance" -> ["time travel"]).
2. Generate 3 to 6 related themes, synonyms, and sub-genres in semanticThemes (e.g. for "money" -> ["wealth", "wall street", "cash", "heist", "finance", "greed", "robbery"]).
3. Extract liked titles (e.g. "The Godfather"), disliked titles, desired genres, excluded genres, excluded content (e.g. "violent", "jump scares").
4. Identify mood (e.g., "tired", "stressed", "romantic", "adventurous", "curious").
5. Determine watchEffort ("low", "medium", "high") based on hints like "tired", "easy watch", "no brainer".
6. Determine intensity ("low", "medium", "high") based on hints like "intense", "adrenaline", "lighthearted".
7. Detect conflicts (e.g. tired + action + liked The Godfather) and formulate a short clarification question if appropriate.
8. Return strictly valid JSON matching the schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a movie recommendation query parser. Convert natural language requests into structured, validated preferences without guessing unknown facts. Always identify topic and keyword subjects accurately.',
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mediaType: { type: Type.STRING, enum: ['movie', 'tv', 'all'] },
            mood: { type: Type.ARRAY, items: { type: Type.STRING } },
            genres: { type: Type.ARRAY, items: { type: Type.STRING } },
            searchKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            semanticThemes: { type: Type.ARRAY, items: { type: Type.STRING } },
            likedTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
            dislikedTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
            mustInclude: { type: Type.ARRAY, items: { type: Type.STRING } },
            excludeGenres: { type: Type.ARRAY, items: { type: Type.STRING } },
            excludeContent: { type: Type.ARRAY, items: { type: Type.STRING } },
            language: { type: Type.STRING, nullable: true },
            region: { type: Type.STRING, nullable: true },
            maxRuntimeMinutes: { type: Type.INTEGER, nullable: true },
            intensity: { type: Type.STRING, enum: ['low', 'medium', 'high'], nullable: true },
            watchEffort: { type: Type.STRING, enum: ['low', 'medium', 'high'], nullable: true },
            clarificationNeeded: { type: Type.BOOLEAN },
            clarificationQuestion: { type: Type.STRING, nullable: true },
          },
          required: ['mediaType', 'mood', 'genres', 'likedTitles', 'excludeGenres', 'excludeContent'],
        },
      },
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) {
      return parseQueryDeterministically(text, structuredInputs);
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and sanitize values
    const validGenres = parsed.genres?.filter((g: string) =>
      KNOWN_GENRES.some((kg) => kg.toLowerCase() === g.toLowerCase())
    ) || [];

    const validExcludeGenres = parsed.excludeGenres?.filter((g: string) =>
      KNOWN_GENRES.some((kg) => kg.toLowerCase() === g.toLowerCase())
    ) || [];

    // Fallback deterministic extraction for keywords if Gemini returned empty
    const deterministic = parseQueryDeterministically(text, structuredInputs);
    const resolvedKeywords =
      parsed.searchKeywords && parsed.searchKeywords.length > 0
        ? parsed.searchKeywords
        : deterministic.searchKeywords;

    const resolvedThemes = Array.from(
      new Set([
        ...(parsed.semanticThemes || []),
        ...(deterministic.semanticThemes || []),
        ...resolvedKeywords,
      ])
    );

    // Prioritize structured form inputs if provided
    return {
      mediaType: structuredInputs?.mediaType || (parsed.mediaType as MediaType) || 'movie',
      mood: structuredInputs?.mood && structuredInputs.mood.length > 0 ? structuredInputs.mood : parsed.mood || [],
      genres: structuredInputs?.genres && structuredInputs.genres.length > 0 ? structuredInputs.genres : validGenres,
      searchKeywords: structuredInputs?.searchKeywords && structuredInputs.searchKeywords.length > 0 ? structuredInputs.searchKeywords : resolvedKeywords,
      semanticThemes: resolvedThemes,
      rawQuery: text.trim(),
      likedTitles: structuredInputs?.likedTitles || parsed.likedTitles || [],
      dislikedTitles: structuredInputs?.dislikedTitles || parsed.dislikedTitles || [],
      mustInclude: structuredInputs?.mustInclude || parsed.mustInclude || [],
      excludeGenres: structuredInputs?.excludeGenres || validExcludeGenres,
      excludeContent: structuredInputs?.excludeContent || parsed.excludeContent || [],
      language: structuredInputs?.language || parsed.language || null,
      region: structuredInputs?.region || parsed.region || 'IN',
      maxRuntimeMinutes: structuredInputs?.maxRuntimeMinutes ?? parsed.maxRuntimeMinutes ?? null,
      releasePeriod: structuredInputs?.releasePeriod || null,
      intensity: (structuredInputs?.intensity as Intensity) || (parsed.intensity as Intensity) || null,
      watchEffort: (structuredInputs?.watchEffort as WatchEffort) || (parsed.watchEffort as WatchEffort) || null,
      clarificationNeeded: Boolean(parsed.clarificationNeeded),
      clarificationQuestion: parsed.clarificationQuestion || null,
    };
  } catch {
    return parseQueryDeterministically(text, structuredInputs);
  }
}
