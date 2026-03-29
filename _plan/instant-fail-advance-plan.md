# Instant fail-advance feature plan

## Goal
Make the game advance immediately when all currently connected players have submitted wrong answers for a question, instead of waiting for the timer to expire.

## Why
Players who have already answered incorrectly should not be forced to wait for the remaining countdown. This improves pacing and reduces dead time during a multiplayer round.

## Scope
- Server-side only.
- No UI changes outside of existing `question:end` and `round:phase` events.
- No changes to frontend timer rendering.
- No support for unanswered disconnected players.

## Implementation steps
1. Update `server/socket/handlers/questionHandlers.js`.
   - After rejecting a wrong answer, evaluate whether all connected players have submitted.
   - Use `game.questionSubmissions` and `game.players.filter((p) => p.connected)`.
   - If all connected players have submitted and `game.questionAnswered` is still false, call `endQuestion(io, gameId, null, null)` immediately.

2. Preserve existing flow.
   - Do not alter the correct-answer path.
   - Do not call `endQuestion` early if the question is already answered.
   - Ensure disconnected players are not counted toward the submission requirement.

3. Keep timer cleanup safe.
   - `endQuestion` already clears `game.questionTimer`.
   - No additional timer cleanup should be required beyond the existing flow.

4. Add helper logic if needed.
   - If the same logic is used in multiple places, extract a small utility such as `allConnectedPlayersSubmitted(game)`.
   - Keep the check local to the question submission path unless reuse is clearly warranted.

## Test plan
1. Add or extend `server/socket/handlers/questionHandlers.test.js`.
   - `it("ends the question immediately when all connected players submit wrong answers")`
   - `it("does not end the question early if a connected player has not submitted")`
   - `it("ignores disconnected players when determining whether all submissions are complete")`

2. Verify behavior with mocked timers or a fake `questionTimer`.
   - Confirm the early end path triggers `endQuestion` immediately.
   - Confirm normal timeout path still exists when not all connected players have submitted.

3. Cover regression cases.
   - Wrong answer does not call `endQuestion` if the game is already over or if the round phase is not `question_live`.
   - Correct answer path remains unchanged.

## Success criteria
- The server ends the question immediately once the final connected wrong answer arrives.
- The game still emits the correct answer and transitions normally.
- No extra wait occurs for all-wrong submissions.
- Existing correct-answer behavior continues to work.
