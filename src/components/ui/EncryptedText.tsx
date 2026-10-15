import React, { useEffect, useState, useRef } from "react";

interface EncryptedTextProps {
  text: string;
  isActive?: boolean;
  isResolved?: boolean;
  isCompleted?: boolean;
  revealDelayMs?: number;
  scrambleIntervalMs?: number;
  encryptedClassName?: string;
  revealedClassName?: string;
  className?: string;
  glyphs?: string;
  onRevealComplete?: () => void;
}

const LUXURY_CIPHER_GLYPHS = "01◈⟡∷█▞⬡_~·/0x";

export const EncryptedText: React.FC<EncryptedTextProps> = ({
  text,
  isActive = false,
  isResolved = true,
  isCompleted = false,
  revealDelayMs = 24,
  scrambleIntervalMs = 38,
  encryptedClassName = "opacity-55 font-mono tracking-wide",
  revealedClassName = "font-bold",
  className = "",
  glyphs = LUXURY_CIPHER_GLYPHS,
  onRevealComplete,
}) => {
  const [revealedCount, setRevealedCount] = useState<number>(() => {
    return isCompleted ? text.length : 0;
  });

  const generateScramble = () => {
    return Array.from({ length: text.length }, (_, i) => {
      if (text[i] === " ") return " ";
      return glyphs[Math.floor(Math.random() * glyphs.length)];
    });
  };

  const [scrambleChars, setScrambleChars] = useState<string[]>(generateScramble);
  const intervalRef = useRef<number | null>(null);
  const onRevealCompleteRef = useRef(onRevealComplete);
  onRevealCompleteRef.current = onRevealComplete;
  const hasTriggeredCompleteRef = useRef(false);

  useEffect(() => {
    if (isCompleted) {
      setRevealedCount(text.length);
      hasTriggeredCompleteRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (!isActive) {
      setRevealedCount(0);
      hasTriggeredCompleteRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Active state - Case 1: Milestone still running -> continuous scramble glyphs
    if (!isResolved) {
      setRevealedCount(0);
      hasTriggeredCompleteRef.current = false;
      intervalRef.current = window.setInterval(() => {
        setScrambleChars(generateScramble());
      }, scrambleIntervalMs);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }

    // Active state - Case 2: Milestone completed -> progressive decryption cascade
    let current = 0;
    const total = text.length;
    setRevealedCount(0);
    hasTriggeredCompleteRef.current = false;

    intervalRef.current = window.setInterval(() => {
      // Jitter remaining cipher characters while revealing from left to right
      setScrambleChars(generateScramble());

      current += 1;
      setRevealedCount(Math.min(current, total));

      if (current >= total) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (!hasTriggeredCompleteRef.current) {
          hasTriggeredCompleteRef.current = true;
          onRevealCompleteRef.current?.();
        }
      }
    }, revealDelayMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, isResolved, isCompleted, text, revealDelayMs, scrambleIntervalMs]);

  // If pending (not active and not completed), render quiet text
  if (!isActive && !isCompleted) {
    return <span className={className}>{text}</span>;
  }

  // If completed, render full resolved string
  if (isCompleted) {
    return <span className={`${className} ${revealedClassName}`}>{text}</span>;
  }

  // Active state: revealed real characters + scrambling cipher characters (spaces preserved)
  const revealedPart = text.slice(0, revealedCount);
  const scrambledPart = scrambleChars.slice(revealedCount).join("");

  return (
    <span className={className}>
      <span className={revealedClassName}>{revealedPart}</span>
      <span className={encryptedClassName}>{scrambledPart}</span>
    </span>
  );
};
