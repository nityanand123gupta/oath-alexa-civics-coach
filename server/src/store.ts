import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { QuestionProgress } from "@oath/civics-kit";

export interface Profile {
  /** ISO date the N-400 was (or will be) filed — determines the test version. */
  filingDate: string | null;
  interviewDate: string | null;
  dateOfBirth: string | null;
  lprSince: string | null;
  /** BCP-47-ish language code for explanations: en, es, hi, zh, vi, tl */
  explanationLanguage: string;
  displayName: string;
}

export interface PersistedState {
  profile: Profile;
  /** questionId -> progress */
  progress: Record<string, QuestionProgress>;
  /** mock interview history for the progress card */
  mockResults: { at: number; version: string; result: "pass" | "fail"; correct: number; incorrect: number }[];
}

const DEFAULT_STATE: PersistedState = {
  profile: {
    filingDate: null,
    interviewDate: null,
    dateOfBirth: null,
    lprSince: null,
    explanationLanguage: "en",
    displayName: "there",
  },
  progress: {},
  mockResults: [],
};

const here = dirname(fileURLToPath(import.meta.url));

export class Store {
  private state: PersistedState;
  private file: string;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(file?: string) {
    this.file = file ?? join(here, "..", "data", "state.json");
    this.state = this.load();
  }

  private load(): PersistedState {
    try {
      if (existsSync(this.file)) {
        const raw = JSON.parse(readFileSync(this.file, "utf8")) as PersistedState;
        return {
          ...structuredClone(DEFAULT_STATE),
          ...raw,
          profile: { ...DEFAULT_STATE.profile, ...raw.profile },
        };
      }
    } catch (e) {
      console.error(`[store] failed to read ${this.file}; starting fresh:`, (e as Error).message);
    }
    return structuredClone(DEFAULT_STATE);
  }

  get profile(): Profile {
    return this.state.profile;
  }

  updateProfile(patch: Partial<Profile>): Profile {
    this.state.profile = { ...this.state.profile, ...patch };
    this.scheduleFlush();
    return this.state.profile;
  }

  progressMap(): Map<string, QuestionProgress> {
    return new Map(Object.entries(this.state.progress));
  }

  getProgress(questionId: string): QuestionProgress | undefined {
    return this.state.progress[questionId];
  }

  setProgress(p: QuestionProgress): void {
    this.state.progress[p.questionId] = p;
    this.scheduleFlush();
  }

  recordMockResult(r: PersistedState["mockResults"][number]): void {
    this.state.mockResults.push(r);
    this.scheduleFlush();
  }

  get mockResults() {
    return this.state.mockResults;
  }

  reset(): void {
    this.state = structuredClone(DEFAULT_STATE);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 250);
    // don't keep the process alive just to flush
    this.flushTimer.unref?.();
  }

  flush(): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.state, null, 2), "utf8");
      renameSync(tmp, this.file);
    } catch (e) {
      console.error("[store] flush failed (continuing in memory):", (e as Error).message);
    }
  }
}
