import React from 'react';
import { WizardState } from '../types';
import { ArrowRight, ArrowLeft, Sparkles, Check, Search, Wand2 } from 'lucide-react';

interface WizardProps {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
  onSubmit: (directQuery?: string) => void;
  isLoading: boolean;
}

const SAMPLE_QUERIES = [
  "I'm tired, want an action movie, and I like The Godfather",
  "A light comedy under 100 minutes",
  "Intense sci-fi thriller like Inception",
  "Gentle family animation without violence",
];

const MOODS = [
  { label: 'Happy', desc: 'Upbeat & joyous' },
  { label: 'Relaxed', desc: 'Cozy & mellow' },
  { label: 'Tired', desc: 'Easy watch, zero effort' },
  { label: 'Stressed', desc: 'Comfort & escapism' },
  { label: 'Romantic', desc: 'Love & connection' },
  { label: 'Adventurous', desc: 'Thrills & grandeur' },
  { label: 'Curious', desc: 'Intrigue & mysteries' },
  { label: 'Sad', desc: 'Cathartic & warm' },
];

const GENRES = [
  'Surprise me',
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
];

const AUDIENCES = [
  { label: 'Just me', desc: 'Solo viewing party' },
  { label: 'Partner', desc: 'Date night vibes' },
  { label: 'Friends', desc: 'Crowd-pleaser energy' },
  { label: 'Family with kids', desc: 'Wholesome & kid-safe' },
];

const RUNTIMES = [
  { label: 'Under 90 min', desc: 'Quick & sweet' },
  { label: 'Under 2 hours', desc: 'Standard length' },
  { label: 'Under 2.5 hours', desc: 'Deep dive' },
  { label: 'Any length', desc: 'Epics welcome' },
];

const LANGUAGES = [
  'Any',
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Korean',
  'Japanese',
  'Spanish',
  'French',
];

export const Wizard: React.FC<WizardProps> = ({
  state,
  onChange,
  onNext,
  onBack,
  onSubmit,
  isLoading,
}) => {
  const { step, naturalQuery, mood, genres, audience, maxRuntime, languages, preferences, note } = state;

  // Toggle genre logic (up to 3, handling "Surprise me")
  const handleGenreToggle = (g: string) => {
    if (g === 'Surprise me') {
      onChange({ genres: ['Surprise me'] });
      return;
    }
    const filtered = genres.filter((x) => x !== 'Surprise me');
    if (filtered.includes(g)) {
      onChange({ genres: filtered.filter((x) => x !== g) });
    } else {
      if (filtered.length >= 3) {
        onChange({ genres: [...filtered.slice(1), g] });
      } else {
        onChange({ genres: [...filtered, g] });
      }
    }
  };

  // Toggle language logic
  const handleLanguageToggle = (lang: string) => {
    if (lang === 'Any') {
      onChange({ languages: ['Any'] });
      return;
    }
    const filtered = languages.filter((l) => l !== 'Any');
    if (filtered.includes(lang)) {
      const next = filtered.filter((l) => l !== lang);
      onChange({ languages: next.length === 0 ? ['Any'] : next });
    } else {
      onChange({ languages: [...filtered, lang] });
    }
  };

  // Screen 0: Hero with Natural Language Search + Guided Wizard
  if (step === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center max-w-2xl mx-auto py-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#141414] border border-[#232323] text-xs font-medium text-[#FF7A2F] mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Natural Language & Guided Discovery</span>
        </div>

        <h1 className="font-heading text-4xl sm:text-6xl font-bold tracking-tight text-[#F5F5F5] leading-tight">
          Movie Night <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E63946] to-[#FF7A2F]">Picker</span>
        </h1>

        <p className="mt-3 text-base sm:text-lg text-[#8C8C8C] max-w-lg leading-relaxed">
          Tell us your vibe, favorite movies, or exact mood.
        </p>

        {/* Natural Language Prompt Input */}
        <div className="w-full mt-8 text-left space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (naturalQuery.trim()) {
                onSubmit(naturalQuery.trim());
              }
            }}
            className="relative flex items-center"
          >
            <Search className="absolute left-4 w-5 h-5 text-[#8C8C8C]" />
            <input
              type="text"
              id="natural-query-input"
              aria-label="Describe movie vibe, genre, or favorite title"
              value={naturalQuery}
              onChange={(e) => onChange({ naturalQuery: e.target.value })}
              placeholder="e.g. I'm tired, want an action movie, and I like The Godfather"
              className="w-full pl-12 pr-32 py-4 rounded-[16px] bg-[#141414] border border-[#232323] focus:border-[#FF7A2F] text-[#F5F5F5] placeholder-[#666666] outline-none transition-all duration-200 text-sm sm:text-base shadow-inner focus:shadow-[0_0_20px_-4px_rgba(255,122,47,0.3)] focus:ring-1 focus:ring-[#FF7A2F]"
            />
            <button
              type="submit"
              aria-label="Search movie recommendations"
              disabled={isLoading || !naturalQuery.trim()}
              className="absolute right-2 px-4 py-2 rounded-[12px] bg-gradient-to-r from-[#E63946] to-[#FF7A2F] text-white font-medium text-sm flex items-center gap-1.5 transition-all duration-200 hover:opacity-95 disabled:opacity-40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF7A2F]"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Search</span>
            </button>
          </form>

          {/* Quick Prompts */}
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-xs text-[#666666] self-center">Try:</span>
            {SAMPLE_QUERIES.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onChange({ naturalQuery: sample });
                  onSubmit(sample);
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-[#161616] border border-[#252525] text-[#a0a0a0] hover:text-white hover:border-[#FF7A2F]/50 transition-colors cursor-pointer text-left truncate max-w-full"
              >
                "{sample}"
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full my-8">
          <div className="flex-grow h-px bg-[#202020]" />
          <span className="text-xs text-[#666666] uppercase tracking-wider">or answer questions</span>
          <div className="flex-grow h-px bg-[#202020]" />
        </div>

        {/* Guided Wizard Button */}
        <button
          onClick={onNext}
          className="w-full sm:w-auto px-8 py-3.5 rounded-[16px] bg-[#141414] border border-[#232323] hover:border-[#FF7A2F] text-[#F5F5F5] font-heading font-semibold text-base flex items-center justify-center gap-2.5 transition-all duration-200 hover:shadow-[0_0_20px_-4px_rgba(255,122,47,0.3)] cursor-pointer"
        >
          <span>Start Guided Wizard</span>
          <ArrowRight className="w-4 h-4 text-[#FF7A2F]" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow w-full max-w-2xl mx-auto px-4 py-8 justify-between">
      {/* Top back navigation */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-[#8C8C8C] hover:text-[#F5F5F5] transition-colors duration-200 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <span className="text-xs font-mono text-[#8C8C8C]">
          Question {step} of 7
        </span>
      </div>

      {/* Main Question Container */}
      <div className="flex-grow flex flex-col justify-center my-auto py-4">
        {/* QUESTION 1: MOOD */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-[#F5F5F5]">
                What's your mood tonight?
              </h2>
              <p className="text-sm text-[#8C8C8C] mt-2">
                Pick the energy you're looking for.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {MOODS.map((item) => {
                const isSelected = mood === item.label;
                return (
                  <button
                    key={item.label}
                    onClick={() => onChange({ mood: item.label })}
                    className={`p-4 rounded-[16px] border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between h-28 ${
                      isSelected
                        ? 'bg-[#1a1412] border-[#FF7A2F] shadow-[0_0_20px_-4px_rgba(255,122,47,0.4)] text-white'
                        : 'bg-[#141414] border-[#232323] hover:border-[#383838] text-[#F5F5F5]'
                    }`}
                  >
                    <span className="font-heading font-semibold text-lg">{item.label}</span>
                    <span className="text-xs text-[#8C8C8C] leading-snug">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* QUESTION 2: GENRES */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <div className="flex items-baseline justify-between">
                <h2 className="font-heading text-3xl sm:text-4xl font-bold text-[#F5F5F5]">
                  What genres are on the table?
                </h2>
                <span className="text-xs text-[#8C8C8C] shrink-0">Up to 3</span>
              </div>
              <p className="text-sm text-[#8C8C8C] mt-2">
                Select your favorite genres or let us surprise you.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              {GENRES.map((g) => {
                const isSelected = genres.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() => handleGenreToggle(g)}
                    className={`px-4 py-2.5 rounded-[16px] border text-sm font-medium transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-[#1a1412] border-[#FF7A2F] text-white shadow-[0_0_18px_-4px_rgba(255,122,47,0.4)]'
                        : 'bg-[#141414] border-[#232323] text-[#F5F5F5] hover:border-[#383838]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#FF7A2F]" />}
                    <span>{g}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* QUESTION 3: AUDIENCE */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-[#F5F5F5]">
                Who's watching?
              </h2>
              <p className="text-sm text-[#8C8C8C] mt-2">
                We'll tailor the tone and rating to match your party.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {AUDIENCES.map((item) => {
                const isSelected = audience === item.label;
                return (
                  <button
                    key={item.label}
                    onClick={() => onChange({ audience: item.label })}
                    className={`p-5 rounded-[16px] border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#1a1412] border-[#FF7A2F] text-white shadow-[0_0_20px_-4px_rgba(255,122,47,0.4)]'
                        : 'bg-[#141414] border-[#232323] text-[#F5F5F5] hover:border-[#383838]'
                    }`}
                  >
                    <span className="font-heading font-semibold text-lg">{item.label}</span>
                    <span className="text-xs text-[#8C8C8C] mt-1">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* QUESTION 4: RUNTIME */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-[#F5F5F5]">
                How much time do you have?
              </h2>
              <p className="text-sm text-[#8C8C8C] mt-2">
                Keep it tight or settle in for an epic.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {RUNTIMES.map((item) => {
                const isSelected = maxRuntime === item.label;
                return (
                  <button
                    key={item.label}
                    onClick={() => onChange({ maxRuntime: item.label })}
                    className={`p-5 rounded-[16px] border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#1a1412] border-[#FF7A2F] text-white shadow-[0_0_20px_-4px_rgba(255,122,47,0.4)]'
                        : 'bg-[#141414] border-[#232323] text-[#F5F5F5] hover:border-[#383838]'
                    }`}
                  >
                    <span className="font-heading font-semibold text-lg">{item.label}</span>
                    <span className="text-xs text-[#8C8C8C] mt-1">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* QUESTION 5: LANGUAGE */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-[#F5F5F5]">
                Any language preference?
              </h2>
              <p className="text-sm text-[#8C8C8C] mt-2">
                Optional. Select multiple or leave as Any.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              {LANGUAGES.map((lang) => {
                const isSelected = languages.includes(lang);
                return (
                  <button
                    key={lang}
                    onClick={() => handleLanguageToggle(lang)}
                    className={`px-4 py-2.5 rounded-[16px] border text-sm font-medium transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-[#1a1412] border-[#FF7A2F] text-white shadow-[0_0_18px_-4px_rgba(255,122,47,0.4)]'
                        : 'bg-[#141414] border-[#232323] text-[#F5F5F5] hover:border-[#383838]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#FF7A2F]" />}
                    <span>{lang}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* QUESTION 6: PREFERENCES */}
        {step === 6 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-[#F5F5F5]">
                Any fine-tuning?
              </h2>
              <p className="text-sm text-[#8C8C8C] mt-2">
                Optional filters to narrow down the vibe.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() =>
                  onChange({
                    preferences: { ...preferences, highlyRated: !preferences.highlyRated },
                  })
                }
                className={`w-full p-4 rounded-[16px] border text-left flex items-center justify-between transition-all duration-200 cursor-pointer ${
                  preferences.highlyRated
                    ? 'bg-[#1a1412] border-[#FF7A2F] shadow-[0_0_18px_-4px_rgba(255,122,47,0.4)] text-white'
                    : 'bg-[#141414] border-[#232323] text-[#F5F5F5] hover:border-[#383838]'
                }`}
              >
                <div>
                  <div className="font-medium text-base">Highly rated only (7+)</div>
                  <div className="text-xs text-[#8C8C8C]">Only critically acclaimed crowd favorites</div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                    preferences.highlyRated ? 'border-[#FF7A2F] bg-[#FF7A2F]' : 'border-[#383838]'
                  }`}
                >
                  {preferences.highlyRated && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                </div>
              </button>

              <button
                onClick={() =>
                  onChange({
                    preferences: { ...preferences, hiddenGems: !preferences.hiddenGems },
                  })
                }
                className={`w-full p-4 rounded-[16px] border text-left flex items-center justify-between transition-all duration-200 cursor-pointer ${
                  preferences.hiddenGems
                    ? 'bg-[#1a1412] border-[#FF7A2F] shadow-[0_0_18px_-4px_rgba(255,122,47,0.4)] text-white'
                    : 'bg-[#141414] border-[#232323] text-[#F5F5F5] hover:border-[#383838]'
                }`}
              >
                <div>
                  <div className="font-medium text-base">Hidden gems</div>
                  <div className="text-xs text-[#8C8C8C]">Lesser-known, high quality finds</div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                    preferences.hiddenGems ? 'border-[#FF7A2F] bg-[#FF7A2F]' : 'border-[#383838]'
                  }`}
                >
                  {preferences.hiddenGems && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                </div>
              </button>

              <button
                onClick={() =>
                  onChange({
                    preferences: {
                      ...preferences,
                      recent: !preferences.recent,
                      classics: false,
                    },
                  })
                }
                className={`w-full p-4 rounded-[16px] border text-left flex items-center justify-between transition-all duration-200 cursor-pointer ${
                  preferences.recent
                    ? 'bg-[#1a1412] border-[#FF7A2F] shadow-[0_0_18px_-4px_rgba(255,122,47,0.4)] text-white'
                    : 'bg-[#141414] border-[#232323] text-[#F5F5F5] hover:border-[#383838]'
                }`}
              >
                <div>
                  <div className="font-medium text-base">Recent (last 5 years)</div>
                  <div className="text-xs text-[#8C8C8C]">Fresh modern cinema</div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                    preferences.recent ? 'border-[#FF7A2F] bg-[#FF7A2F]' : 'border-[#383838]'
                  }`}
                >
                  {preferences.recent && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                </div>
              </button>

              <button
                onClick={() =>
                  onChange({
                    preferences: {
                      ...preferences,
                      classics: !preferences.classics,
                      recent: false,
                    },
                  })
                }
                className={`w-full p-4 rounded-[16px] border text-left flex items-center justify-between transition-all duration-200 cursor-pointer ${
                  preferences.classics
                    ? 'bg-[#1a1412] border-[#FF7A2F] shadow-[0_0_18px_-4px_rgba(255,122,47,0.4)] text-white'
                    : 'bg-[#141414] border-[#232323] text-[#F5F5F5] hover:border-[#383838]'
                }`}
              >
                <div>
                  <div className="font-medium text-base">Classics (before 2000)</div>
                  <div className="text-xs text-[#8C8C8C]">Timeless cinematic history</div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                    preferences.classics ? 'border-[#FF7A2F] bg-[#FF7A2F]' : 'border-[#383838]'
                  }`}
                >
                  {preferences.classics && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                </div>
              </button>

              {audience !== 'Family with kids' ? (
                <button
                  onClick={() =>
                    onChange({
                      preferences: { ...preferences, mature: !preferences.mature },
                    })
                  }
                  className={`w-full p-4 rounded-[16px] border text-left flex items-center justify-between transition-all duration-200 cursor-pointer ${
                    preferences.mature
                      ? 'bg-[#1a1412] border-[#FF7A2F] shadow-[0_0_18px_-4px_rgba(255,122,47,0.4)] text-white'
                      : 'bg-[#141414] border-[#232323] text-[#F5F5F5] hover:border-[#383838]'
                }`}
              >
                <div>
                  <div className="font-medium text-base">Include mature content</div>
                  <div className="text-xs text-[#8C8C8C]">Allows R-rated and adult themes</div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                    preferences.mature ? 'border-[#FF7A2F] bg-[#FF7A2F]' : 'border-[#383838]'
                  }`}
                >
                  {preferences.mature && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                </div>
              </button>
              ) : (
                <div className="p-3.5 rounded-[16px] bg-[#141414] border border-[#232323] text-xs text-[#8C8C8C] flex items-center justify-between">
                  <span>Include mature content</span>
                  <span className="text-[#FF7A2F] font-medium">Off (Family mode)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* QUESTION 7: OPTIONAL FREE TEXT */}
        {step === 7 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-[#F5F5F5]">
                Anything else?
              </h2>
              <p className="text-sm text-[#8C8C8C] mt-2">
                A movie you loved (e.g. "Like The Godfather"), specific vibe, or things to avoid.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <div className="relative">
                <textarea
                  value={note}
                  onChange={(e) => onChange({ note: e.target.value.slice(0, 200) })}
                  placeholder="e.g. 'Loved The Godfather and Knives Out' or 'No jump scares'"
                  maxLength={200}
                  rows={4}
                  className="w-full p-4 rounded-[16px] bg-[#141414] border border-[#232323] focus:border-[#FF7A2F] text-[#F5F5F5] placeholder-[#666666] outline-none transition-all duration-200 resize-none font-normal text-base shadow-inner focus:shadow-[0_0_20px_-4px_rgba(255,122,47,0.3)]"
                />
                <span className="absolute bottom-3 right-3 text-xs text-[#666666] font-mono">
                  {note.length}/200
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Button */}
      <div className="pt-8">
        {step < 7 ? (
          <button
            onClick={onNext}
            className="w-full py-4 rounded-[16px] bg-gradient-to-br from-[#E63946] to-[#FF7A2F] text-white font-heading font-semibold text-lg flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-[0_0_25px_-4px_rgba(255,122,47,0.45)] hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <span>Next</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => onSubmit()}
            disabled={isLoading}
            className="w-full py-4 rounded-[16px] bg-gradient-to-br from-[#E63946] to-[#FF7A2F] text-white font-heading font-semibold text-lg flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-[0_0_25px_-4px_rgba(255,122,47,0.45)] hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5" />
            <span>Find my movies</span>
          </button>
        )}
      </div>
    </div>
  );
};
