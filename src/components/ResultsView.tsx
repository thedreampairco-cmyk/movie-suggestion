import React, { useState } from 'react';
import { Movie, ResultGroup, ClarificationInfo } from '../types';
import { MovieCard } from './MovieCard';
import {
  RotateCcw,
  RefreshCw,
  Sparkles,
  AlertCircle,
  HelpCircle,
  SlidersHorizontal,
  Bookmark,
} from 'lucide-react';

interface ResultsViewProps {
  movies: Movie[];
  groups?: ResultGroup[];
  clarification?: ClarificationInfo | null;
  savedMovieIds: number[];
  isLoading: boolean;
  onMore: () => void;
  onReset: () => void;
  onBackToFilters: () => void;
  onClarifyAnswer: (choice: string) => void;
  onSaveMovie: (movie: Movie) => void;
  onMoreLikeThis: (movie: Movie) => void;
  onNotInterested: (movieId: number) => void;
  onAlreadyWatched: (movieId: number) => void;
  onOpenSavedModal: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  movies,
  groups,
  clarification,
  savedMovieIds,
  isLoading,
  onMore,
  onReset,
  onBackToFilters,
  onClarifyAnswer,
  onSaveMovie,
  onMoreLikeThis,
  onNotInterested,
  onAlreadyWatched,
  onOpenSavedModal,
}) => {
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);

  // Tasteful loading animation: pulsing red/orange glow, no technical text
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 text-center my-auto">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-28 h-28 rounded-full bg-gradient-to-r from-[#E63946] to-[#FF7A2F] opacity-30 blur-xl animate-pulse" />
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#E63946] to-[#FF7A2F] flex items-center justify-center shadow-[0_0_30px_rgba(255,122,47,0.5)]">
            <Sparkles className="w-8 h-8 text-white animate-spin" style={{ animationDuration: '4s' }} />
          </div>
        </div>
        <h2 className="font-heading text-2xl font-bold text-[#F5F5F5] mt-8 tracking-wide">
          Curating and ranking tonight's picks...
        </h2>
        <p className="text-sm text-[#8C8C8C] mt-2">
          Analyzing mood, genre signals, and seed titles
        </p>
      </div>
    );
  }

  // Friendly empty state
  if (!movies || movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center max-w-md mx-auto my-auto space-y-6">
        <div className="w-14 h-14 rounded-full bg-[#141414] border border-[#232323] flex items-center justify-center text-[#FF7A2F]">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="font-heading text-2xl font-bold text-[#F5F5F5]">
            No perfect match found
          </h2>
          <p className="text-sm text-[#8C8C8C] mt-2 leading-relaxed">
            Try relaxing a few exclusions, broadening the runtime, or checking your title spelling.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={onBackToFilters}
            className="flex-1 py-3.5 rounded-[16px] bg-[#141414] border border-[#232323] hover:border-[#FF7A2F] text-[#F5F5F5] font-medium text-sm transition-all duration-200 cursor-pointer"
          >
            Adjust search
          </button>
          <button
            onClick={onReset}
            className="flex-1 py-3.5 rounded-[16px] bg-gradient-to-br from-[#E63946] to-[#FF7A2F] text-white font-medium text-sm transition-all duration-200 hover:shadow-[0_0_20px_-4px_rgba(255,122,47,0.4)] cursor-pointer"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  // Displayed movies: either the active group or the top 3 ranked movies
  const displayedMovies =
    groups && activeGroupIndex !== null && groups[activeGroupIndex]
      ? groups[activeGroupIndex].movies
      : movies;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 flex flex-col items-center space-y-8 animate-fade-in">
      {/* Top Bar with Saved Counter */}
      <div className="w-full flex items-center justify-between">
        <button
          onClick={onBackToFilters}
          className="text-xs text-[#8C8C8C] hover:text-[#F5F5F5] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Edit Search / Filters</span>
        </button>

        {savedMovieIds.length > 0 && (
          <button
            onClick={onOpenSavedModal}
            className="text-xs text-[#FF7A2F] hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a1412] border border-[#FF7A2F]/40 transition-colors cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5 fill-[#FF7A2F]" />
            <span>Saved ({savedMovieIds.length})</span>
          </button>
        )}
      </div>

      {/* Clarification Banner (Requirement G) */}
      {clarification && (
        <div className="w-full max-w-2xl bg-[#141414] border border-[#FF7A2F]/40 rounded-[16px] p-5 shadow-[0_0_20px_-4px_rgba(255,122,47,0.2)] text-left space-y-3">
          <div className="flex items-start gap-2.5">
            <HelpCircle className="w-5 h-5 text-[#FF7A2F] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-[#F5F5F5]">Quick Clarification</h4>
              <p className="text-xs text-[#8C8C8C] mt-0.5 leading-relaxed">
                {clarification.question}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {clarification.options && clarification.options.length > 0 ? (
              clarification.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => onClarifyAnswer(opt)}
                  className="px-3.5 py-1.5 rounded-full bg-[#1f1f1f] hover:bg-[#282828] border border-[#333] hover:border-[#FF7A2F] text-xs font-medium text-[#F5F5F5] transition-colors cursor-pointer"
                >
                  {opt}
                </button>
              ))
            ) : (
              <>
                <button
                  onClick={() => onClarifyAnswer('Easy-to-follow action')}
                  className="px-3.5 py-1.5 rounded-full bg-[#1f1f1f] hover:bg-[#282828] border border-[#333] hover:border-[#FF7A2F] text-xs font-medium text-[#F5F5F5] transition-colors cursor-pointer"
                >
                  Easy-to-follow action
                </button>
                <button
                  onClick={() => onClarifyAnswer('Darker / more intense')}
                  className="px-3.5 py-1.5 rounded-full bg-[#1f1f1f] hover:bg-[#282828] border border-[#333] hover:border-[#FF7A2F] text-xs font-medium text-[#F5F5F5] transition-colors cursor-pointer"
                >
                  Darker / more intense
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center max-w-lg space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#141414] border border-[#232323] text-xs font-medium text-[#FF7A2F]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Multi-signal ranked picks</span>
        </div>
        <h2 className="font-heading text-3xl sm:text-4xl font-bold text-[#F5F5F5]">
          Your Ranked Movie Picks
        </h2>
        <p className="text-sm text-[#8C8C8C]">
          Scored across genre alignment, mood effort, seed similarity, and critical quality.
        </p>
      </div>

      {/* Labeled Result Groups Switcher (Requirement G) */}
      {groups && groups.length > 1 && (
        <div className="w-full max-w-xl flex flex-col items-center space-y-2">
          <div className="text-xs text-[#8C8C8C]">Select a category to explore:</div>
          <div className="flex items-center gap-2 p-1 rounded-full bg-[#141414] border border-[#232323]">
            <button
              onClick={() => setActiveGroupIndex(null)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                activeGroupIndex === null
                  ? 'bg-gradient-to-r from-[#E63946] to-[#FF7A2F] text-white shadow'
                  : 'text-[#8C8C8C] hover:text-[#F5F5F5]'
              }`}
            >
              Best Overall Mix
            </button>
            {groups.map((grp, gIdx) => (
              <button
                key={gIdx}
                onClick={() => setActiveGroupIndex(gIdx)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  activeGroupIndex === gIdx
                    ? 'bg-gradient-to-r from-[#E63946] to-[#FF7A2F] text-white shadow'
                    : 'text-[#8C8C8C] hover:text-[#F5F5F5]'
                }`}
              >
                {grp.label}
              </button>
            ))}
          </div>
          {activeGroupIndex !== null && groups[activeGroupIndex] && (
            <p className="text-xs text-[#FF7A2F] italic text-center">
              {groups[activeGroupIndex].description}
            </p>
          )}
        </div>
      )}

      {/* Exactly 3 movie cards in a responsive row (stacked on mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full items-stretch">
        {displayedMovies.map((movie, index) => (
          <MovieCard
            key={`${movie.id}-${index}`}
            movie={movie}
            index={index}
            isSaved={savedMovieIds.includes(movie.id)}
            onSave={onSaveMovie}
            onMoreLikeThis={onMoreLikeThis}
            onNotInterested={onNotInterested}
            onAlreadyWatched={onAlreadyWatched}
          />
        ))}
      </div>

      {/* Actions: "Show me 3 more" & "Start over" */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md pt-4">
        <button
          onClick={onMore}
          disabled={isLoading}
          className="w-full sm:flex-1 py-3.5 px-6 rounded-[16px] bg-gradient-to-br from-[#E63946] to-[#FF7A2F] text-white font-heading font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-[0_0_22px_-4px_rgba(255,122,47,0.45)] hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Show me 3 more</span>
        </button>

        <button
          onClick={onReset}
          className="w-full sm:flex-1 py-3.5 px-6 rounded-[16px] bg-[#141414] border border-[#232323] hover:border-[#FF7A2F] text-[#F5F5F5] font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-[0_0_15px_-4px_rgba(255,122,47,0.25)] cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-[#8C8C8C]" />
          <span>Start over</span>
        </button>
      </div>
    </div>
  );
};
