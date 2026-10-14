import React from 'react';
import { Movie } from '../types';
import { X, Trash2, Clock, Star, Film } from 'lucide-react';

interface SavedModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedMovies: Movie[];
  onRemoveMovie: (movieId: number) => void;
  onClearAll: () => void;
}

export const SavedModal: React.FC<SavedModalProps> = ({
  isOpen,
  onClose,
  savedMovies,
  onRemoveMovie,
  onClearAll,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#141414] border border-[#282828] rounded-[20px] shadow-2xl p-6 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#232323]">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-[#FF7A2F]" />
            <h3 className="font-heading text-xl font-bold text-[#F5F5F5]">
              Saved Movies & Shows ({savedMovies.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C8C8C] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-grow overflow-y-auto py-4 space-y-3">
          {savedMovies.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#8C8C8C]">
              No saved titles yet. Click the bookmark icon on any recommendation card to save it for later.
            </div>
          ) : (
            savedMovies.map((movie) => (
              <div
                key={movie.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] transition-colors"
              >
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="w-12 h-16 object-cover rounded-lg bg-[#202020] shrink-0"
                />
                <div className="flex-grow min-w-0">
                  <h4 className="font-heading font-semibold text-sm text-[#F5F5F5] truncate">
                    {movie.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-[#8C8C8C]">
                    <span>{movie.year}</span>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-[#FF7A2F] text-[#FF7A2F]" />
                      <span>{movie.rating.toFixed(1)}</span>
                    </div>
                    {movie.runtime && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#8C8C8C]" />
                          <span>{movie.runtime}m</span>
                        </div>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-[#FF7A2F] italic line-clamp-1 mt-1">
                    "{movie.reason}"
                  </p>
                </div>
                <button
                  onClick={() => onRemoveMovie(movie.id)}
                  title="Remove from saved"
                  className="p-2 text-[#8C8C8C] hover:text-[#E63946] transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer actions */}
        {savedMovies.length > 0 && (
          <div className="pt-4 border-t border-[#232323] flex items-center justify-between">
            <button
              onClick={onClearAll}
              className="text-xs text-[#8C8C8C] hover:text-[#E63946] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear all saved & feedback data</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#222] hover:bg-[#2c2c2c] text-xs font-medium text-white transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
