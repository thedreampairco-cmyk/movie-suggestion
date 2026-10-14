import { useState, useEffect } from 'react';
import { WizardState, Movie, ResultGroup, ClarificationInfo, UserFeedback } from './types';
import { Wizard } from './components/Wizard';
import { ResultsView } from './components/ResultsView';
import { SavedModal } from './components/SavedModal';

const INITIAL_STATE: WizardState = {
  step: 0,
  naturalQuery: '',
  mood: 'Relaxed',
  genres: ['Surprise me'],
  audience: 'Just me',
  maxRuntime: 'Under 2 hours',
  languages: ['Any'],
  preferences: {
    highlyRated: false,
    hiddenGems: false,
    recent: false,
    classics: false,
    mature: false,
  },
  note: '',
};

const FEEDBACK_STORAGE_KEY = 'movie_picker_user_feedback_v2';

export default function App() {
  const [wizardState, setWizardState] = useState<WizardState>(INITIAL_STATE);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [groups, setGroups] = useState<ResultGroup[] | undefined>();
  const [clarification, setClarification] = useState<ClarificationInfo | null>(null);
  const [seenMovieIds, setSeenMovieIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);

  // Local feedback state stored in browser localStorage (Requirement H)
  const [feedback, setFeedback] = useState<UserFeedback>(() => {
    try {
      const stored = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore
    }
    return {
      savedMovies: [],
      notInterestedIds: [],
      watchedIds: [],
      likedTitles: [],
      dislikedTitles: [],
    };
  });

  // Sync feedback to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(feedback));
    } catch {
      // Ignore
    }
  }, [feedback]);

  // Update wizard properties
  const handleUpdate = (updates: Partial<WizardState>) => {
    setWizardState((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    setWizardState((prev) => ({ ...prev, step: prev.step + 1 }));
  };

  const handleBack = () => {
    setWizardState((prev) => ({ ...prev, step: Math.max(0, prev.step - 1) }));
  };

  const handleBackToFilters = () => {
    setWizardState((prev) => ({ ...prev, step: prev.naturalQuery ? 0 : 6 }));
  };

  const handleReset = () => {
    setWizardState(INITIAL_STATE);
    setMovies([]);
    setGroups(undefined);
    setClarification(null);
    setSeenMovieIds([]);
  };

  // Fetch recommendations from /api/recommend
  const fetchRecommendations = async (
    directQuery?: string,
    clarificationSelection?: string,
    customExclude?: number[]
  ) => {
    setIsLoading(true);
    setWizardState((prev) => ({ ...prev, step: 8 })); // Results view

    const allExcluded = Array.from(
      new Set([
        ...(customExclude ?? seenMovieIds),
        ...feedback.notInterestedIds,
        ...feedback.watchedIds,
      ])
    );

    try {
      const isFromHero = Boolean(directQuery || wizardState.step === 0);
      const payload = {
        query: directQuery ?? (wizardState.naturalQuery || undefined),
        isDirectSearch: isFromHero,
        mood: isFromHero ? undefined : wizardState.mood,
        genres: isFromHero ? undefined : wizardState.genres,
        audience: isFromHero ? undefined : wizardState.audience,
        maxRuntime: isFromHero ? undefined : wizardState.maxRuntime,
        languages: isFromHero ? undefined : wizardState.languages,
        preferences: isFromHero ? undefined : wizardState.preferences,
        note: wizardState.note,
        excludeIds: allExcluded,
        feedback: {
          likedTitles: feedback.likedTitles,
          dislikedTitles: feedback.dislikedTitles,
        },
        clarificationSelection,
      };

      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const data = await res.json();
      const newMovies: Movie[] = Array.isArray(data.movies) ? data.movies : [];

      setMovies(newMovies);
      setGroups(data.groups);
      setClarification(data.clarification);

      const newIds = newMovies.map((m) => m.id);
      setSeenMovieIds((prev) => Array.from(new Set([...prev, ...newIds])));
    } catch {
      setMovies([]);
      setGroups(undefined);
      setClarification(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMore = () => {
    fetchRecommendations();
  };

  const handleClarifyAnswer = (choice: string) => {
    fetchRecommendations(undefined, choice);
  };

  // Feedback Actions
  const handleSaveMovie = (movie: Movie) => {
    setFeedback((prev) => {
      const exists = prev.savedMovies.some((m) => m.id === movie.id);
      const updatedSaved = exists
        ? prev.savedMovies.filter((m) => m.id !== movie.id)
        : [...prev.savedMovies, movie];
      return { ...prev, savedMovies: updatedSaved };
    });
  };

  const handleRemoveSaved = (movieId: number) => {
    setFeedback((prev) => ({
      ...prev,
      savedMovies: prev.savedMovies.filter((m) => m.id !== movieId),
    }));
  };

  const handleMoreLikeThis = (movie: Movie) => {
    setFeedback((prev) => ({
      ...prev,
      likedTitles: Array.from(new Set([...prev.likedTitles, movie.title])),
    }));
    // Trigger updated recommendations weighted towards this movie
    fetchRecommendations(`More like ${movie.title} with similar themes and genres`);
  };

  const handleNotInterested = (movieId: number) => {
    setFeedback((prev) => ({
      ...prev,
      notInterestedIds: Array.from(new Set([...prev.notInterestedIds, movieId])),
    }));
    // Remove from active list
    setMovies((prev) => prev.filter((m) => m.id !== movieId));
  };

  const handleAlreadyWatched = (movieId: number) => {
    setFeedback((prev) => ({
      ...prev,
      watchedIds: Array.from(new Set([...prev.watchedIds, movieId])),
    }));
    // Remove from active list
    setMovies((prev) => prev.filter((m) => m.id !== movieId));
  };

  const handleClearAllFeedback = () => {
    const emptyFeedback: UserFeedback = {
      savedMovies: [],
      notInterestedIds: [],
      watchedIds: [],
      likedTitles: [],
      dislikedTitles: [],
    };
    setFeedback(emptyFeedback);
    localStorage.removeItem(FEEDBACK_STORAGE_KEY);
    setIsSavedModalOpen(false);
  };

  // Progress Bar calculation (steps 1 through 7)
  const progressPercent =
    wizardState.step === 0
      ? 0
      : wizardState.step >= 8
      ? 100
      : Math.round((wizardState.step / 7) * 100);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] flex flex-col justify-between selection:bg-[#E63946]/30 selection:text-[#F5F5F5]">
      {/* Thin red-to-orange progress bar at top */}
      {wizardState.step > 0 && wizardState.step < 8 && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-[#1a1a1a] z-50 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#E63946] to-[#FF7A2F] transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col justify-center items-center w-full">
        {wizardState.step < 8 ? (
          <Wizard
            state={wizardState}
            onChange={handleUpdate}
            onNext={handleNext}
            onBack={handleBack}
            onSubmit={(directQuery) => fetchRecommendations(directQuery, undefined, [])}
            isLoading={isLoading}
          />
        ) : (
          <ResultsView
            movies={movies}
            groups={groups}
            clarification={clarification}
            savedMovieIds={feedback.savedMovies.map((m) => m.id)}
            isLoading={isLoading}
            onMore={handleMore}
            onReset={handleReset}
            onBackToFilters={handleBackToFilters}
            onClarifyAnswer={handleClarifyAnswer}
            onSaveMovie={handleSaveMovie}
            onMoreLikeThis={handleMoreLikeThis}
            onNotInterested={handleNotInterested}
            onAlreadyWatched={handleAlreadyWatched}
            onOpenSavedModal={() => setIsSavedModalOpen(true)}
          />
        )}
      </main>

      {/* Saved Movies & Feedback Modal */}
      <SavedModal
        isOpen={isSavedModalOpen}
        onClose={() => setIsSavedModalOpen(false)}
        savedMovies={feedback.savedMovies}
        onRemoveMovie={handleRemoveSaved}
        onClearAll={handleClearAllFeedback}
      />

      {/* Strict minimal footer */}
      <footer className="w-full py-4 text-center text-xs text-[#8C8C8C] shrink-0 border-t border-[#141414]">
        <span>Movie data by TMDB</span>
      </footer>
    </div>
  );
}
