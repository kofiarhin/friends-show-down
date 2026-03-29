# Chat Feature Specification

## Overview

Add a timed social chat / banter utility to the trivia app. The chat is available in three safe zones: the lobby, the post-question intermission, and the results screen. The chat is explicitly disabled during active question rounds to avoid distraction and minimize unfair advantage.

## Goals

- Give players a lightweight way to socialize while waiting.
- Preserve competitive focus during active questions.
- Keep chat transient, simple, and tied to game state.
- Avoid introducing persistence or moderation complexity.
- Support all players in the same game session.

## Scope

Includes:

- UI in `LobbyScreen`, `GameScreen` intermission state, and `ResultsScreen`
- Socket-based chat event flow
- Backend validation of chat availability and payload shape
- Minimal client state in Redux under `gameSlice`
- Basic tests for allowed/disallowed chat flows

Excludes:

- Persistent chat history beyond the current game session
- Private/direct messages
- Rich content (images, attachments, emojis beyond plain text)
- Moderation, profanity filtering, or user reporting

## UX

### Behavior

- Lobby: chat available while players wait for host and before game start.
- Intermission: chat available during the countdown between questions.
- Results: chat available after game ends for post-game discussion.
- Active question: chat input disabled or hidden.
- Messages appear in chronological order, newest at the bottom.
- The chat panel auto-scrolls to the latest message.
- New messages are broadcast to all connected players in the same game.

### Placement

- Lobby: side panel or footer area below player list.
- Intermission: panel below question results or next question countdown.
- Results: full-screen area or side panel below final rankings.

### States

- Active zone: input enabled, send button active.
- Disabled zone: input disabled + help text like "Chat available after this question."
- Connection error: show non-blocking notice if socket event fails.

## API / Socket Contract

### Client → Server

- `chat:send`
  - payload: `{ gameId, playerId, message }`
  - meaning: submit a chat message for the current game session.

### Server → Client

- `chat:message`
  - payload: `{ gameId, playerId, nickname, message, timestamp }`
  - meaning: broadcast a validated chat message to room members.
- `chat:error`
  - payload: `{ gameId, code, message }`
  - meaning: inform sender of invalid chat submission.

### Room semantics

- Chat messages are scoped to `gameId`.
- Only players currently in the game room receive `chat:message` events.
- The server should not trust `gameId` or `playerId` from the client without verification.

## Backend Validation

### Where

- Add validation in `server/socket/handlers/gameHandlers.js` or a new `chatHandlers.js` module.
- Reuse existing game store / authorization helpers.

### Rules

- `gameId` must exist in game store.
- `playerId` must belong to the game and represent an active player in the room.
- `message` must be a non-empty string.
- `message` length cap: e.g. 250 characters.
- Chat only allowed when game status is one of:
  - `lobby`
  - `intermission` (post-question pause)
  - `results`
- Reject submissions during `activeQuestion` or any other invalid game phase.
- Trim whitespace and reject if empty after trimming.

### Response

- On success: broadcast `chat:message` to game room.
- On failure: emit `chat:error` to the sender only.
- Do not crash or throw on invalid input; return a guarded error event.

## Frontend State Changes

### Redux updates

- Add chat state in `client/src/store/gameSlice.js`:
  - `chat.messages: []`
  - `chat.enabled: boolean`
  - `chat.sendStatus: 'idle' | 'pending' | 'failed'`
  - optional: `chat.error` string
- Add reducers/actions for:
  - `chatMessageReceived`
  - `chatSendPending`
  - `chatSendSuccess`
  - `chatSendFailure`
  - `chatClearMessages` when leaving a game

### Socket event handling

- In `client/src/hooks/useSocketEvents.js`, subscribe to:
  - `chat:message` → dispatch `chatMessageReceived`
  - `chat:error` → dispatch `chatSendFailure`
- Use existing connection logic; do not create a second socket instance.

### UI behavior

- Determine `chat.enabled` from current game phase:
  - `lobby` = enabled
  - `intermission` = enabled
  - `results` = enabled
  - `activeQuestion` = disabled
- Update the relevant screen components to render the chat panel only when allowed.
- Keep a single shared `ChatPanel` component if possible, reused across lobby, intermission, and results.
- Reset chat state when leaving the game or when the game closes.

### Example component contract

- `ChatPanel` props:
  - `enabled`
  - `messages`
  - `onSend(message)`
  - `error`
  - `placeholder`

## Testing Requirements

### Backend tests

- Add Jest coverage for chat handler validation.
- Test cases:
  - valid chat in lobby → broadcasts `chat:message`
  - valid chat in intermission → broadcasts
  - valid chat in results → broadcasts
  - invalid chat during active question → sends `chat:error`
  - invalid message payloads: empty string, whitespace only, missing fields, too long
  - invalid player / game IDs → `chat:error`
  - ensure invalid chat does not mutate game state or broadcast to room

### Frontend tests

- Add component tests for `ChatPanel` or screen-level chat state.
- Test cases:
  - enabled in lobby and intermission/results screens
  - disabled during active question with help text shown
  - message list renders new `chat:message` events
  - user attempts to send while disabled should be blocked client-side
  - `chat:error` displays failure notice without crashing
- Add event integration tests for `useSocketEvents` if existing architecture supports it.

### E2E / Integration notes

- If not available now, add a lightweight smoke test covering:
  - join game, send chat in lobby, receive chat on another client
  - start game, ensure chat disabled during active question
  - finish game, ensure chat enabled on results

## Implementation Notes

- Keep feature additive and low-risk.
- Reuse existing socket room join/leave logic.
- Do not store chat outside the current game object.
- Prefer a single `ChatPanel` UI unit to avoid duplicated code.
- Keep message payload minimal and deterministic.

## Success Criteria

- Players can send and receive chat in lobby, intermission, and results.
- Chat input is unavailable during active questions.
- Backend rejects invalid or out-of-phase chat cleanly.
- Tests cover allowed and disallowed chat flows.
- UI behavior is consistent across the three allowed states.
