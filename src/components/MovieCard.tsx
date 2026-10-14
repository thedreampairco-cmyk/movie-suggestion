import React, { useState } from 'react';
import { Movie } from '../types';
import {
  Star,
  Clock,
  Sparkles,
  Bookmark,
  ThumbsUp,
  EyeOff,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Film,
  Tv,
} from 'lucide-react';

interface MovieCardProps {
  movie: Movie;
  index: number;
  isSaved?: boolean;
  onSave?: (movie: Movie) => void;
  onMoreLikeThis?: (movie: Movie) => void;
  onNotInterested?: (movieId: number) => void;
  onAlreadyWatched?: (movieId: number) => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  isSaved = false,
  onSave,
  onMoreLikeThis,
  onNotInterested,
  onAlreadyWatched,
}) => {
  const [imageError, setImageError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Format runtime in hours and minutes
  const formatRuntime = (mins?: number) => {
    if (!mins || mins <= 0) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}` : `${m}m`;
  };

  const formattedRuntime = formatRuntime(movie.runtime);

  return (
    <div className="group relative flex flex-col bg-[#141414] border border-[#232323] hover:border-[#FF7A2F]/50 rounded-[16px] overflow-hidden transition-all duration-200 hover:shadow-[0_0_24px_-6px_rgba(255,122,47,0.35)] w-full">
      {/* Top Floating Badges */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 flex-wrap">
          {movie.isHiddenGem && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF7A2F] text-black font-semibold text-xs shadow-md tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Hidden gem</span>
            </div>
          )}

          {movie.mediaType && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-[#2e2e2e] text-[11px] font-medium text-[#d0d0d0]">
              {movie.mediaType === 'tv' ? <Tv className="w-3 h-3 text-[#FF7A2F]" /> : <Film className="w-3 h-3 text-[#FF7A2F]" />}
              <span>{movie.mediaType === 'tv' ? 'Series' : 'Movie'}</span>
            </div>
          )}
        </div>

        {/* Match Score Badge */}
        {movie.matchScore !== undefined && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#E63946] to-[#FF7A2F] text-white text-xs font-bold shadow-md">
            <span>{movie.matchScore}% Match</span>
          </div>
        )}
      </div>

      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full bg-[#181818] overflow-hidden">
        {!imageError && movie.posterUrl ? (
          <img
            src={movie.posterUrl}
            alt={movie.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#1c1c1c] to-[#121212]">
            <span className="font-heading text-lg font-bold text-[#F5F5F5]">{movie.title}</span>
            <span className="text-xs text-[#8C8C8C] mt-2">{movie.year}</span>
          </div>
        )}

        {/* Gradient overlay at bottom of poster */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent opacity-80 pointer-events-none" />

        {/* Rating Floating Tag */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-[#2e2e2e] text-xs font-semibold text-[#F5F5F5]">
          <Star className="w-3.5 h-3.5 fill-[#FF7A2F] text-[#FF7A2F]" />
          <span>{movie.rating ? movie.rating.toFixed(1) : '7.5'}</span>
        </div>
      </div>

      {/* Card Content */}
      <div className="flex flex-col flex-grow p-5 space-y-3">
        {/* Title & Year */}
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-heading text-xl font-bold text-[#F5F5F5] line-clamp-1 group-hover:text-white transition-colors duration-200">
              {movie.title}
            </h3>
            <span className="text-sm font-medium text-[#8C8C8C] shrink-0">{movie.year}</span>
          </div>

          {/* Meta row: Genres & Runtime */}
          <div className="flex items-center flex-wrap gap-2 mt-1.5 text-xs text-[#8C8C8C]">
            {formattedRuntime && (
              <>
                <div className="flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-[#FF7A2F]" />
                  <span>{formattedRuntime}</span>
                </div>
                <span>•</span>
              </>
            )}
            <div className="flex items-center flex-wrap gap-1.5">
              {movie.genres.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="px-2 py-0.5 rounded-md bg-[#1f1f1f] text-[#d0d0d0] text-[11px] font-medium"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Overview: 2 lines */}
        <p className="text-sm text-[#8C8C8C] leading-relaxed line-clamp-2 flex-grow">
          {movie.overview}
        </p>

        {/* Missing Data indicator if any */}
        {movie.missingDataIndicators && movie.missingDataIndicators.length > 0 && (
          <div className="text-[11px] text-[#8C8C8C]/80 italic">
            * {movie.missingDataIndicators.join(', ')}
          </div>
        )}

        {/* "Why this fits you" personalized explanation */}
        <div className="pt-2 border-t border-[#232323]">
          <p className="text-xs text-[#FF7A2F] font-medium italic line-clamp-2 leading-snug">
            "{movie.reason}"
          </p>

          {/* Expandable Match Evidence */}
          {movie.matchReasons && movie.matchReasons.length > 1 && (
            <div className="mt-1.5">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="inline-flex items-center gap-1 text-[11px] text-[#8C8C8C] hover:text-[#d0d0d0] transition-colors cursor-pointer"
              >
                <span>{showDetails ? 'Hide match breakdown' : 'Why it ranked here'}</span>
                {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showDetails && (
                <ul className="mt-2 space-y-1 text-[11px] text-[#b0b0b0] bg-[#1a1a1a] p-2.5 rounded-lg border border-[#2a2a2a]">
                  {movie.matchReasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-[#FF7A2F] mt-0.5">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                  {movie.scoreBreakdown && (
                    <li className="pt-1.5 mt-1 border-t border-[#2a2a2a] text-[10px] text-[#8C8C8C] flex justify-between">
                      <span>Genre: {movie.scoreBreakdown.genreMatch}</span>
                      <span>Similarity: {movie.scoreBreakdown.titleSimilarity}</span>
                      <span>Mood: {movie.scoreBreakdown.moodAndEffort}</span>
                      <span>Rating: {movie.scoreBreakdown.qualityConfidence}</span>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Where to watch */}
        <div className="pt-2 border-t border-[#232323]">
          <span className="text-[11px] font-medium tracking-wider text-[#8C8C8C] uppercase block mb-1.5">
            Where to watch
          </span>

          {movie.providers && movie.providers.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              {movie.providers.slice(0, 4).map((p, idx) => (
                <div
                  key={`${p.name}-${idx}`}
                  title={`${p.name}${p.type ? ` (${p.type})` : ''}`}
                  className="group/provider relative flex items-center justify-center w-8 h-8 rounded-lg bg-[#202020] border border-[#2a2a2a] hover:border-[#FF7A2F] overflow-hidden transition-colors duration-200"
                >
                  {p.logoUrl ? (
                    <img
                      src={p.logoUrl}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-[9px] font-bold text-[#F5F5F5]">
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  {/* Tooltip on hover */}
                  <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-1.5 py-0.5 text-[10px] text-[#F5F5F5] opacity-0 transition-opacity group-hover/provider:opacity-100 z-20 border border-[#333]">
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#8C8C8C] italic">
              Not available to stream in your country right now.
            </p>
          )}
        </div>

        {/* Feedback Actions Toolbar (Requirement H) */}
        <div className="pt-2 border-t border-[#232323] flex items-center justify-between text-xs text-[#8C8C8C]">
          <div className="flex items-center gap-1">
            {onMoreLikeThis && (
              <button
                onClick={() => onMoreLikeThis(movie)}
                title="More like this"
                aria-label={`Find more movies like ${movie.title}`}
                className="p-1.5 rounded-md hover:bg-[#202020] hover:text-[#FF7A2F] transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#FF7A2F]"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
            )}

            {onAlreadyWatched && (
              <button
                onClick={() => onAlreadyWatched(movie.id)}
                title="Already watched"
                aria-label={`Mark ${movie.title} as already watched`}
                className="p-1.5 rounded-md hover:bg-[#202020] hover:text-[#FF7A2F] transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#FF7A2F]"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            )}

            {onNotInterested && (
              <button
                onClick={() => onNotInterested(movie.id)}
                title="Not interested"
                aria-label={`Mark ${movie.title} as not interested`}
                className="p-1.5 rounded-md hover:bg-[#202020] hover:text-[#E63946] transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#E63946]"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {onSave && (
            <button
              onClick={() => onSave(movie)}
              title={isSaved ? 'Remove from saved' : 'Save / favorite'}
              aria-label={isSaved ? `Remove ${movie.title} from saved` : `Save ${movie.title} for later`}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#FF7A2F] ${
                isSaved
                  ? 'bg-[#FF7A2F]/20 text-[#FF7A2F] border border-[#FF7A2F]/40'
                  : 'hover:bg-[#202020] hover:text-[#F5F5F5]'
              }`}
            >
              <Bookmark className={`w-3 h-3 ${isSaved ? 'fill-[#FF7A2F]' : ''}`} />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
