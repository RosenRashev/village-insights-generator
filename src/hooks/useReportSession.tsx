import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { ReportSection } from "@/data/mock-report";
import { useAuth } from "@/hooks/useAuth";
import type { PurposeId } from "@/lib/prompt-modules";
import type { Settlement } from "@/lib/settlements";

/**
 * Състоянието на генерирането на доклад живее на ниво приложение, а не в началната страница.
 * Така при преминаване на друга страница и връщане избраното място, прогресът и вече
 * готовият доклад не се губят, а текущото генериране продължава на заден план.
 */

type Progress = { done: number; total: number };

type ReportSessionState = {
  place: Settlement | null;
  setPlace: Dispatch<SetStateAction<Settlement | null>>;
  currentLocation: Settlement | null;
  setCurrentLocation: Dispatch<SetStateAction<Settlement | null>>;
  purpose: PurposeId | null;
  setPurpose: Dispatch<SetStateAction<PurposeId | null>>;
  isPrivate: boolean;
  setIsPrivate: Dispatch<SetStateAction<boolean>>;
  generating: boolean;
  setGenerating: Dispatch<SetStateAction<boolean>>;
  progress: Progress;
  setProgress: Dispatch<SetStateAction<Progress>>;
  realSections: ReportSection[] | null;
  setRealSections: Dispatch<SetStateAction<ReportSection[] | null>>;
  generatedAt: string | undefined;
  setGeneratedAt: Dispatch<SetStateAction<string | undefined>>;
  reset: () => void;
};

const Ctx = createContext<ReportSessionState | null>(null);

export function ReportSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [place, setPlace] = useState<Settlement | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Settlement | null>(null);
  const [purpose, setPurpose] = useState<PurposeId | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<Progress>({ done: 0, total: 0 });
  const [realSections, setRealSections] = useState<ReportSection[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | undefined>(undefined);

  const reset = () => {
    setPlace(null);
    setCurrentLocation(null);
    setPurpose(null);
    setIsPrivate(false);
    setRealSections(null);
    setGeneratedAt(undefined);
    setProgress({ done: 0, total: 0 });
  };

  // При смяна на потребителя (изход/вход с друг акаунт) нищо от предишния не остава.
  const lastUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const id = user?.id ?? null;
    if (lastUser.current !== undefined && lastUser.current !== id) reset();
    lastUser.current = id;
  }, [user?.id]);

  const value: ReportSessionState = {
    place,
    setPlace,
    currentLocation,
    setCurrentLocation,
    purpose,
    setPurpose,
    isPrivate,
    setIsPrivate,
    generating,
    setGenerating,
    progress,
    setProgress,
    realSections,
    setRealSections,
    generatedAt,
    setGeneratedAt,
    reset,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReportSession(): ReportSessionState {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useReportSession трябва да се използва вътре в ReportSessionProvider.");
  return ctx;
}
