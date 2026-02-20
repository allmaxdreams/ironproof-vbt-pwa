import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Repetition = {
    id: string;
    repNumber: number;
    peakVelocity: number;
    meanVelocity?: number;
};

export type ExerciseSet = {
    id: string;
    exerciseName: string;
    weightKg: number;
    targetReps: number;
    reps: Repetition[];
};

export type WorkoutSession = {
    id: string;
    timestamp: number;
    notes: string;
    sets: ExerciseSet[];
};

interface WorkoutStore {
    sessions: WorkoutSession[];
    activeSessionId: string | null;
    activeSetId: string | null;

    startSession: (notes?: string) => void;
    endSession: () => void;
    startSet: (exerciseName: string, weightKg: number, targetReps: number) => void;
    endSet: () => void;
    addRep: (peakVelocity: number, meanVelocity?: number) => void;
}

export const useWorkoutStore = create<WorkoutStore>()(
    persist(
        (set) => ({
            sessions: [],
            activeSessionId: null,
            activeSetId: null,

            startSession: (notes = '') => set((state) => {
                const newSession: WorkoutSession = {
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    notes,
                    sets: []
                };
                return {
                    sessions: [newSession, ...state.sessions],
                    activeSessionId: newSession.id
                };
            }),

            endSession: () => set({ activeSessionId: null, activeSetId: null }),

            startSet: (exerciseName, weightKg, targetReps) => set((state) => {
                if (!state.activeSessionId) return state;

                const newSet: ExerciseSet = {
                    id: crypto.randomUUID(),
                    exerciseName,
                    weightKg,
                    targetReps,
                    reps: []
                };

                return {
                    sessions: state.sessions.map(s => {
                        if (s.id === state.activeSessionId) {
                            return { ...s, sets: [...s.sets, newSet] };
                        }
                        return s;
                    }),
                    activeSetId: newSet.id
                };
            }),

            endSet: () => set({ activeSetId: null }),

            addRep: (peakVelocity, meanVelocity) => set((state) => {
                if (!state.activeSessionId || !state.activeSetId) return state;

                return {
                    sessions: state.sessions.map(s => {
                        if (s.id === state.activeSessionId) {
                            return {
                                ...s,
                                sets: s.sets.map(exSet => {
                                    if (exSet.id === state.activeSetId) {
                                        const newRep: Repetition = {
                                            id: crypto.randomUUID(),
                                            repNumber: exSet.reps.length + 1,
                                            peakVelocity,
                                            meanVelocity
                                        };
                                        return { ...exSet, reps: [...exSet.reps, newRep] };
                                    }
                                    return exSet;
                                })
                            };
                        }
                        return s;
                    })
                };
            })
        }),
        {
            name: 'vbt-workout-storage',
        }
    )
);
