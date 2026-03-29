# Gameplay Animations for the Live Round

## Summary

The current gameplay experience is functional but visually static. Question changes, answer submission, result reveal, the hype countdown, and pause/resume all appear instantly with no motion cues, which makes round transitions feel abrupt. This feature adds a lightweight, client-only animation layer to the live gameplay flow so the game feels more energetic without changing the existing socket contract, scoring logic, or route flow.

## Goal

Make active gameplay feel more polished and game-like by adding subtle, fast, performance-safe animations to the live round UI, using the existing Redux/socket state as the source of truth.

## Non-Goals

- Add a third-party animation library in v1.
- Change server events, payload shapes, timers, scoring, or round sequencing.
- Redesign lobby, home, or post-game screens.
- Add sound effects, haptics, particles, confetti, or canvas-based effects.
- Introduce long cinematic transitions that delay interaction.
- Rework the existing Tailwind-based visual design system.

## Problem

During live play, state changes happen correctly but without visual transition:

- `question:start` swaps in a new prompt immediately.
- Answer buttons have only a generic hover transition and no clear selection/lock feedback.
- `QuestionResultOverlay` appears abruptly and the hype countdown has no animated emphasis.
- `MiniLeaderboard` updates scores instantly, which makes score changes easy to miss.
- The pause overlay appears as a hard cut.

Because gameplay is driven by fast socket events, the UI needs motion cues to help players read what just changed without changing any game rules.

## Users / Actors

- Host: manages the room, pauses/resumes rounds, and sees the same gameplay motion as players.
- Player: answers questions and relies on visual feedback to understand round state changes.
- Reconnecting player: may re-enter during `question_live`, `question_hype`, or `paused` and must see the correct current state without broken or stale animation state.

## Core Requirements

1. Add motion only to the active gameplay experience centered around `GameScreen` and its child components.
2. Animate question entry on each new `question:start` so the prompt and answer grid feel newly presented.
3. Add immediate answer-selection feedback when a player taps an option, including a pressed/locked visual state until the round advances.
4. Enhance `CountdownTimer` with urgency motion in the final seconds while keeping the server/client timer behavior unchanged.
5. Animate `QuestionResultOverlay` entrance and emphasize the `question_hype` countdown with a repeating scale/fade pulse tied to the existing countdown value.
6. Make leaderboard changes easier to notice by animating row highlight and score-change emphasis in `MiniLeaderboard` when new scores arrive.
7. Animate pause/resume UI transitions without changing pause/resume rules or socket flow.
8. Respect `prefers-reduced-motion` so motion-heavy transforms and pulses are disabled or reduced for users who opt out.
9. Keep interaction timing intact: animations must never block answer clicks, socket event handling, navigation, or round transitions.
10. Keep implementation client-only unless a concrete blocker is found; the current server payloads already expose enough state for v1.

## User Flows

### 1. New question starts

1. Server emits `question:start`.
2. `useSocketEvents` dispatches `setCurrentQuestion(payload)` as it does today.
3. `GameScreen` treats `questionNumber` as the animation reset boundary.
4. The question card fades/slides in over a short duration.
5. Answer buttons enter with a small stagger or grouped fade-up.
6. The timer appears in sync with the new question and starts counting down immediately.

### 2. Player selects an answer

1. Player clicks an answer while `roundPhase === "question_live"` and the game is not paused.
2. The selected button immediately shows a pressed/locked state.
3. Non-selected options become visibly inactive once `hasAnswered` is true.
4. No extra client delay is introduced before `socket.emit("answer:submit")`.
5. If the player answered incorrectly, the existing one-shot behavior remains unchanged; the selected state persists until the result overlay replaces the question state.

### 3. Result and hype transition

1. Server emits `question:end`, followed by `round:phase` when the next-question hype window begins.
2. `QuestionResultOverlay` enters with a short fade/scale transition instead of appearing instantly.
3. Winner/no-winner text and the correct answer animate in as content blocks, not as separate route changes.
4. When `roundPhase` becomes `question_hype`, the countdown number animates on each integer change so the next question feels imminent.
5. On the final question, the result overlay still animates in, but no hype countdown is shown.

### 4. Score updates after a question

1. Result payload contains `scores`.
2. `MiniLeaderboard` detects which players changed score and which rows changed relative position.
3. Changed rows receive a temporary highlight/flash treatment.
4. Reordered rows update cleanly without layout glitches or duplicate rendering.

### 5. Pause and resume

1. Host pauses during `question_live`.
2. The pause overlay fades in and visually mutes the underlying gameplay UI.
3. Host resumes.
4. The pause overlay fades out and gameplay returns to the current live-question state without replaying unrelated entrance animations.

## File Impact

### Files Confirmed To Exist

- `client/src/screens/GameScreen.jsx` — main live gameplay layout and answer interactions.
- `client/src/components/CountdownTimer.jsx` — current timer UI and countdown state.
- `client/src/components/QuestionResultOverlay.jsx` — result/hype overlay already driven by `roundPhase` and `phaseEndsAt`.
- `client/src/components/MiniLeaderboard.jsx` — score list shown inside the result overlay.
- `client/src/hooks/useSocketEvents.js` — current socket-to-Redux sync point for `question:start`, `question:end`, `round:phase`, `game:paused`, and `game:resumed`.
- `client/src/store/gameSlice.js` — gameplay state shape used by the screen.
- `client/src/screens/GameScreen.test.jsx` — existing client test coverage for hype behavior.
- `client/src/index.css` — actual global stylesheet imported by `client/src/main.jsx`.
- `client/src/main.jsx` — confirms `index.css` is the active style entrypoint.
- `server/socket/handlers/gameHandlers.js` — confirms current server events already provide enough timing and round-phase data for client-only animation work.

### Files To Create

- None required for v1.

### Files To Update

- `client/src/screens/GameScreen.jsx` — add question-entry hooks, selected-answer visual state, and animation-friendly data attributes/classes.
- `client/src/components/CountdownTimer.jsx` — add urgency states for low time and expose stable class/data hooks for styling.
- `client/src/components/QuestionResultOverlay.jsx` — add entrance/phase-specific animation hooks for result and hype states.
- `client/src/components/MiniLeaderboard.jsx` — add temporary score-change highlighting and animation hooks for reordered rows.
- `client/src/index.css` — add gameplay-specific keyframes, transition classes, and reduced-motion overrides.
- `client/src/screens/GameScreen.test.jsx` — extend tests for animation state hooks and non-regression around hype/pause/selection behavior.

## States and Edge Cases

- Reconnect during `question_hype`: the overlay must render the current hype state correctly without depending on a prior animation having already run.
- Reconnect during `paused`: the pause overlay must appear immediately and not flash the answer UI as interactive first.
- Resume during a nearly expired timer: urgency styling must reflect the resumed remaining time, not the original full time limit.
- Rapid question transitions: selected-answer and question-entry state must reset when `questionNumber` changes so stale classes do not leak into the next round.
- Final question: no “Get ready” countdown after the last result because the next state is `game:end`.
- Reduced motion: the UI must remain fully understandable if scale, pulse, slide, and stagger animations are disabled.
- Empty or single-item leaderboard states: row animations must not assume multiple players.
- Long nicknames: motion must not cause layout overflow or text clipping beyond what the current layout already allows.
- Host controls while paused: button state changes must remain usable and not be obscured by animation timing.

## Technical Notes

- Use existing socket/Redux state as the animation trigger source. No new socket events are needed for v1.
- Keep animations CSS-first using `client/src/index.css` and existing class names/data attributes rather than introducing a motion library.
- Do not place new gameplay animation styles in `client/src/App.css`; `main.jsx` imports `index.css`, while `App.css` is not currently wired into the app.
- In `GameScreen`, track the locally selected answer separately from `hasAnswered` so the clicked option can remain visually distinct after submission. Reset that local state on question change.
- Prefer short durations (roughly 150–350ms) for entry/feedback motion. The only repeating animation should be the hype countdown pulse and low-time urgency treatment.
- Keep animation triggers keyed to stable gameplay boundaries already present in state, especially `questionNumber`, `roundPhase`, `playState`, and the overlay countdown value.
- For leaderboard emphasis, compare incoming `scores` against the previous render by `playerId`; highlight rows whose score increased and avoid trying to infer game logic from nickname or array index alone.
- Use `@media (prefers-reduced-motion: reduce)` in `index.css` to disable transform-heavy keyframes and reduce transition durations.
- Tests should validate animation state hooks deterministically (class names, data attributes, rendered states), not frame-by-frame visual timing.
- Keep the implementation resilient to React re-renders caused by Redux updates; motion should be driven by explicit state boundaries, not incidental rerenders.

## Acceptance Criteria

- [ ] A new question entering `GameScreen` visually transitions in rather than appearing as an immediate hard swap.
- [ ] Clicking an answer gives immediate visual feedback on the selected option without delaying the socket submission.
- [ ] The timer shows a stronger urgency treatment in the final seconds and remains accurate after pause/resume.
- [ ] The result overlay animates in for both winner and no-winner outcomes.
- [ ] During `question_hype`, the countdown number visibly pulses or scales on each countdown step.
- [ ] `MiniLeaderboard` clearly highlights score changes when result data arrives.
- [ ] Pausing and resuming the game visually transitions the overlay in and out without breaking gameplay state.
- [ ] Reduced-motion users receive a functional experience with minimal or no animated transforms.
- [ ] No server files require behavioral changes to ship v1 of this feature.
- [ ] Existing gameplay tests are updated or extended to cover the new state hooks and no current hype behavior regresses.

## Open Questions

- Should the animation pass cover only `GameScreen`, or should the same motion language later extend to `ResultsScreen` and lobby views?
- Is a more pronounced “arcade” style desired, or should motion stay subtle and minimal?
- Should leaderboard row reordering be limited to highlight/fade in v1, or is a stronger position-change animation expected?

## Assumptions

- “Some animation to the game play” means a focused polish pass on the live round UI, not a full visual redesign.
- The current Tailwind-based styling and color palette remain in place.
- The existing server timing fields (`roundPhase`, `phaseEndsAt`, question start data, pause/resume data) are sufficient for the first version.
- Adding a new dependency just for animations is not desired unless a follow-up request explicitly asks for it.
