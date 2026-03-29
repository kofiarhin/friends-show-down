# Instant advance on all wrong answers

## Feature

When every active player has submitted an answer and every submission is wrong, the game should end the current question immediately instead of waiting for the question timer to expire.

## Background

In the current codebase, wrong answers are rejected and the question remains live until the question timer expires. This means players who have all clicked and missed the answer still wait for the full time limit before seeing the correct answer.

## Current behavior

- `server/socket/handlers/questionHandlers.js` handles `answer:submit`.
- Correct submissions call `endQuestion(io, gameId, socket.id, player?.nickname ?? null)`.
- Wrong submissions only emit `answer:rejected`.
- `game.questionSubmissions` tracks which players have submitted.
- `game.questionTimer` runs to completion and then calls `endQuestion(io, gameId, null, null)`.

## Desired behavior

- If all active players have submitted and none were correct, end the question immediately.
- The server should immediately emit the question result and transition to the next question without waiting for the remaining countdown.
- This should only happen when every active player has attempted the current question and there is no correct answer.

## Scope

### In scope

- Server-side change only.
- Detect when all active players have submitted wrong answers.
- Call the existing `endQuestion` flow immediately in that case.
- Add unit tests for the new early-exit behavior.

### Out of scope

- Frontend UI changes other than behavior already supported by existing `question:end` and `round:phase` events.
- Changing how the timer is displayed or paused.
- Allowing new players to join mid-question.

## Implementation notes

### Key code paths

- `server/socket/handlers/questionHandlers.js`
  - `answer:submit` processes player answers.
  - Wrong answers currently do not modify `game.questionAnswered`.
  - `game.questionSubmissions` is updated for every submission.
- `server/socket/handlers/gameHandlers.js`
  - `emitQuestion` creates `questionTimer` that expires after `QUESTION_TIME_LIMIT`.
  - `endQuestion` clears `questionTimer` and emits the correct answer result.

### Change idea

1. After a wrong answer is rejected in `questionHandlers.js`, evaluate whether every active player has submitted.
2. Use the current `game.questionSubmissions` set and compare its size to the number of active players:
   - active players = `game.players.filter((p) => p.connected).length`
3. If the counts match and `game.questionAnswered` is still false, call `endQuestion(io, gameId, null, null)`.
4. Ensure this does not trigger when players are disconnected mid-question and remaining connected players still have not submitted.

### Edge cases

- No active players: do nothing and let the timer expire.
- Players reconnecting mid-question: only count currently connected players.
- Duplicate submissions: already protected by `game.questionSubmissions` set.
- All active players submit wrong answers but there is still a correct answer remaining: should still end question.

## Acceptance criteria

- When the last connected player submits an incorrect answer, the question ends immediately.
- The correct answer is shown immediately via `question:end`.
- The transition to the next question proceeds as normal.
- The existing correct-answer flow remains unchanged.
- Players who have not yet submitted because they are disconnected do not force premature ending.

## Test plan

### New tests

- `questionHandlers.test.js`
  - `it("ends the question immediately when all connected players have submitted wrong answers")`
    - Setup a game with two connected players.
    - Add both players to `game.questionSubmissions` by submitting wrong answers.
    - Verify `endQuestion` is called and `game.questionAnswered` becomes true.
  - `it("does not end the question early if some connected players have not submitted")`
    - Setup a game with two connected players.
    - Only one wrong submission.
    - Verify the timer remains active and `questionAnswered` is still false.
  - `it("ignores disconnected players when determining all-submitted")`
    - Setup a game with one connected and one disconnected player.
    - Submit a wrong answer from the connected player.
    - Verify the question ends immediately.

### Regression tests

- Confirm that correct-answer submissions still follow the existing winner path.
- Confirm that an unanswered question still waits for the timer if some active players have not submitted.

## Notes

The implementation should reuse the existing `endQuestion` logic so the only new behavior is the trigger condition for calling it early.
