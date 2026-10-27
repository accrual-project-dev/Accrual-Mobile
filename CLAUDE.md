# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Accrual (formerly Trouvaille) Invariants & Rulebook Linkage

For the complete, non-negotiable architectural and operational rulebook, always adhere strictly to:
- **[GEMINI.md](file:///d:/Project/Trouvaille/GEMINI.md)**
- **[TROUVAILLE_RULES.md](file:///d:/Project/Trouvaille/TROUVAILLE_RULES.md)**
- **[TROUVAILLE_WHITEPAPER.md](file:///d:/Project/Trouvaille/TROUVAILLE_WHITEPAPER.md)**

### Non-Negotiable Core Principles:
1. **Rule 1**: Zero native colored system emojis in UI controls (`lucide-react` vector icons only).
2. **Rule 2 & 7**: Strictly Monochrome Apple Luxury glassmorphism (`#09090c` obsidian / `#f4f4f7` alabaster); zero rainbow utility classes.
3. **Rule 3**: Dynamic Island top safe-area insets (`max(calc(env(safe-area-inset-top, 0px) + 18px), 28px)`).
4. **Rule 5**: Single unified scroll container in `BottomSheet` up to `92dvh`, zero artificial `max-h-[55vh]`, and generous bottom safe-area insets (`max(calc(env(safe-area-inset-bottom, 0px) + 12px), 24px)`).
5. **Rule 6**: Strict 100% pure localization ("No Gado-Gado" mixing).
6. **Rule 8.3**: Exhaustive balance sheet (Neraca) export without truncation or `+account` placeholders.
7. **Rule 9 & 10**: Absolute isolation from `trouvaille-web` (never modify without explicit user prompt).
8. **Rule 10 & 11**: Guest-to-cloud migration safeguards (`trouvaille_pending_guest_migration`), full ISO timestamps (`YYYY-MM-DDTHH:mm:ss`), and operational cashflow isolation from artificial opening balances/corrections.
9. **Rule 12 & 13**: 4/5/6-digit PIN resilience without false lockouts, and StoreKit 2 / RevenueCat entitlement synchronization without stale closures.
