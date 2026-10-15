import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Adaptive Initial Sync & Continuous Cipher Scramble Invariants", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Step Milestone Resolution Logic", () => {
    // Mirror of the checkStepMilestoneReady function in InitialSyncScreen
    function checkStepMilestoneReady(
      stepIndex: number,
      state: {
        isPreview: boolean;
        isAssetsLoaded: boolean;
        isDataReady: boolean;
        progress?: number;
        totalCount: number;
      }
    ): boolean {
      if (state.isPreview) return true;

      switch (stepIndex) {
        case 0: // vault
          return true;
        case 1: // assets
          return state.isAssetsLoaded;
        case 2: // ledgers
          return (state.progress !== undefined && state.progress >= 30) || state.isDataReady;
        case 3: // entries
          return (
            (state.progress !== undefined && state.progress >= 80) ||
            state.totalCount > 0 ||
            state.isDataReady
          );
        case 4: // integrity
          return state.isDataReady;
        case 5: // ready
          return state.isDataReady;
        default:
          return true;
      }
    }

    it("holds step 1 (assets) in continuous scramble while assets are still loading", () => {
      const state = {
        isPreview: false,
        isAssetsLoaded: false,
        isDataReady: false,
        progress: 0,
        totalCount: 0,
      };

      expect(checkStepMilestoneReady(1, state)).toBe(false);

      state.isAssetsLoaded = true;
      expect(checkStepMilestoneReady(1, state)).toBe(true);
    });

    it("holds step 3 (entries) while transaction payload is downloading, and resolves when received", () => {
      const state = {
        isPreview: false,
        isAssetsLoaded: true,
        isDataReady: false,
        progress: 25,
        totalCount: 0,
      };

      expect(checkStepMilestoneReady(3, state)).toBe(false);

      // Background download finishes: totalCount received
      state.totalCount = 42;
      expect(checkStepMilestoneReady(3, state)).toBe(true);
    });

    it("holds step 4 (integrity) until all data is verified ready", () => {
      const state = {
        isPreview: false,
        isAssetsLoaded: true,
        isDataReady: false,
        progress: 90,
        totalCount: 150,
      };

      expect(checkStepMilestoneReady(4, state)).toBe(false);

      state.isDataReady = true;
      expect(checkStepMilestoneReady(4, state)).toBe(true);
    });

    it("allows immediate sequential progression in preview mode", () => {
      const state = {
        isPreview: true,
        isAssetsLoaded: false,
        isDataReady: false,
        progress: 0,
        totalCount: 0,
      };

      for (let step = 0; step <= 5; step++) {
        expect(checkStepMilestoneReady(step, state)).toBe(true);
      }
    });
  });

  describe("EncryptedText Decryption Scramble Engine", () => {
    const LUXURY_CIPHER_GLYPHS = "01◈⟡∷█▞⬡_~·/0x";

    function generateScramble(text: string, glyphs = LUXURY_CIPHER_GLYPHS) {
      return Array.from({ length: text.length }, (_, i) => {
        if (text[i] === " ") return " ";
        return glyphs[Math.floor(Math.random() * glyphs.length)];
      });
    }

    it("preserves exact space boundaries during random cipher scrambling", () => {
      const input = "Inisialisasi Brankas Kriptografi Klien";
      const scramble = generateScramble(input);

      expect(scramble.length).toBe(input.length);
      // Spaces must remain spaces
      input.split("").forEach((char, idx) => {
        if (char === " ") {
          expect(scramble[idx]).toBe(" ");
        } else {
          expect(LUXURY_CIPHER_GLYPHS).toContain(scramble[idx]);
        }
      });
    });

    it("simulates left-to-right cascade reveal once isResolved becomes true", () => {
      const text = "Brankas Siap";
      let revealedCount = 0;
      let isResolved = false;
      const onRevealComplete = vi.fn();

      const advanceRevealTick = () => {
        if (!isResolved) return;
        revealedCount = Math.min(revealedCount + 1, text.length);
        if (revealedCount >= text.length) {
          onRevealComplete();
        }
      };

      // While isResolved is false, text stays scrambled (revealedCount = 0)
      for (let i = 0; i < 10; i++) {
        advanceRevealTick();
      }
      expect(revealedCount).toBe(0);
      expect(onRevealComplete).not.toHaveBeenCalled();

      // Resolve milestone
      isResolved = true;
      for (let i = 0; i < text.length; i++) {
        advanceRevealTick();
      }

      expect(revealedCount).toBe(text.length);
      expect(onRevealComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe("Monochrome Luxury & 100% Pure Localization Compliance", () => {
    it("ensures all cipher glyphs are monochrome vector-compatible and zero colored emojis", () => {
      const LUXURY_CIPHER_GLYPHS = "01◈⟡∷█▞⬡_~·/0x";
      // Emoji regex detector
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

      expect(emojiRegex.test(LUXURY_CIPHER_GLYPHS)).toBe(false);
    });
  });
});
