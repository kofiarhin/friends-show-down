# Acceptance Criteria — Room Lifecycle Fix

**Feature:** Host disconnect grace period for waiting rooms  
**Status:** Planning only — to be verified after implementation

---

## Functional Acceptance Criteria

### AC-01 — Waiting room survives host socket disconnect

- **Given** a game is in `waiting` status with at least one player (the host) in the room
- **When** the host's socket disconnects (network drop, backgrounding, browser close)
- **Then** the room is NOT deleted
- **And** `game.hostDisconnectedAt` is set to a non-null timestamp
- **And** a 10-minute expiry timer is started
- **And** the room remains in the in-memory store
- **And** `GET /api/games/:gameId` returns `200` (not `404`)

### AC-02 — Players receive host offline notification

- **Given** one or more non-host players are in the waiting lobby
- **When** the host socket disconnects
- **Then** all remaining players receive a `host:offline` socket event
- **And** the client displays a non-destructive message indicating the host is temporarily unavailable
- **And** the lobby is NOT closed or redirected to home

### AC-03 — Invited player can open shared link while host is offline

- **Given** the host has disconnected and the room is in the grace period
- **When** an invited user opens the shared link (`/game/:id/join`)
- **Then** `GET /api/games/:gameId` returns `200`
- **And** the name entry screen renders normally
- **And** the user can submit their nickname and be added to the lobby
- **And** the user does NOT see "Game not found. Redirecting..."

### AC-04 — Host can reconnect within grace period

- **Given** the host has disconnected and the 10-minute timer is running
- **When** the host reconnects and submits `game:join` with their nickname and valid `hostToken` before expiry
- **Then** the server validates the `hostToken` against `game.hostToken`
- **And** `game.hostId` is updated to the new `socket.id`
- **And** `game.hostDisconnectedAt` is reset to `null`
- **And** the expiry timer is cancelled
- **And** all players in the room receive `host:reconnected`
- **And** the lobby is fully functional — the host can start the game

### AC-05 — Room expires if host does not reconnect in time

- **Given** the host has disconnected and the 10-minute timer has started
- **When** 10 minutes elapse without the host reconnecting
- **Then** the timer fires and `deleteGame` is called
- **And** all players still in the room receive `game:closed` with `reason: "host_timeout"`
- **And** the client redirects players to the home screen
- **And** `GET /api/games/:gameId` subsequently returns `404`

### AC-06 — Host token persists across page refresh

- **Given** the host has created a game and a `hostToken` has been stored in `localStorage`
- **When** the host refreshes the browser before or after entering a nickname
- **Then** the client reads `hostToken` from `localStorage` on mount in `NameEntryScreen`
- **And** the token is included in the `game:join` payload when attempting host reclaim
- **And** the server accepts the reconnect as a valid host if the token matches

### AC-07 — Non-host disconnect is unaffected

- **Given** a non-host player disconnects in the waiting lobby
- **When** the disconnect handler runs
- **Then** the existing behaviour is preserved: `markDisconnected` is called and `lobby:updated` is emitted
- **And** the room is NOT closed
- **And** the host does NOT receive `host:offline`

### AC-08 — Explicit host leave still destroys the room immediately

- **Given** the host explicitly closes or leaves the room from the waiting lobby using the current host-close flow
- **When** the server processes that explicit leave/close action
- **Then** `game:closed` is emitted immediately with the appropriate reason
- **And** the room is deleted immediately
- **And** no grace period timer is started
- **And** this behaviour is unchanged from before the fix

### AC-09 — Wrong client cannot claim host role

- **Given** a non-host player tries to reconnect using the host's nickname but without the correct `hostToken`
- **When** they emit `game:join` with `hostToken: null` or an invalid value
- **Then** the server emits `join:error: "Host reconnection requires a valid host token."`
- **And** the room remains intact
- **And** the legitimate host is unaffected

### AC-10 — Lobby reconnect does not leave host as a ghost

- **Given** the host is already on the lobby screen and their socket disconnects and reconnects with a new `socket.id`
- **When** the client detects the Socket.IO reconnect
- **Then** the lobby triggers a re-join flow using the stored nickname + `hostToken`
- **And** the server waiting-state reconnect branch updates `game.hostId` to the new socket id
- **And** the host can subsequently emit `game:start` successfully
- **And** the host is NOT left in a ghost state where host-only actions silently fail

### AC-11 — `localStorage` tokens are cleaned up

- **Given** a game ends, is closed, or a new game is created
- **When** the relevant event fires on the client
- **Then** the `fsd:hostToken:<gameId>` key is removed from `localStorage`
- **And** stale tokens do not accumulate across sessions

---

> **Note on AC numbering:** AC-10 was inserted for lobby ghost prevention. Any previous token-cleanup AC should now be referenced as AC-11.

---

## Reconnect Scenarios

### RS-01 — Host reconnects after brief network blip (< 30 seconds)

- Host is in the lobby on desktop/mobile
- Network drops for 10–30 seconds
- Socket auto-reconnects with a new `socket.id`
- `LobbyScreen` detects the reconnect via the socket `connect` event and triggers re-join — either auto-emitting `game:join` with stored nickname + token, or routing through the join screen (implementation decision)
- Server validates the token in the waiting-state reconnect branch, updates `game.hostId`, resets `hostDisconnectedAt`, cancels the timer, and emits `host:reconnected` + `lobby:updated`
- All players see `host:reconnected`
- The host can successfully perform host-only actions after reconnect

### RS-02 — Host reconnects after backgrounding the app (< 2 minutes)

- Host uses the share sheet on iOS Safari
- App is backgrounded; socket disconnects
- Host returns to the browser tab
- Socket reconnects; host is on the lobby or join screen
- Host submits `game:join` with token from `localStorage`
- Room is alive; host rejoins; lobby resumes

### RS-03 — Host refreshes browser in the lobby

- Host is in the lobby and refreshes the page
- Redux is cleared; host session state in memory is gone
- `NameEntryScreen` reads `hostToken` from `localStorage` and restores reclaim capability
- Host enters their nickname; `game:join` payload includes `hostToken`
- Server finds the existing player by nickname, validates token, updates `socket.id`
- Host is back in the lobby as host

### RS-04 — Host reconnects after 10-minute expiry

- Host disconnected; 10-minute timer fired; room was deleted
- Host attempts to re-join via the old URL
- `GET /api/games/:gameId` returns `404`
- Client shows "Game not found. Redirecting..."
- Host must create a new game

### RS-05 — Host reconnects before expiry, then disconnects again

- Host disconnects → timer starts
- Host reconnects before 10 min → timer cancelled; `hostDisconnectedAt` cleared
- Host disconnects again → new timer starts (10 min from this disconnect)
- Process repeats; no stale timers accumulate

---

## Mobile / Background / Share-Flow Scenarios

### MO-01 — iOS Safari share sheet

- Host taps browser share icon
- Share sheet opens; tab is backgrounded
- Socket disconnects
- Invited user opens shared link within 10 minutes
- `GET /api/games/:gameId` returns `200`
- User can join

### MO-02 — Android Chrome share intent

- Host taps share; Android share intent shows
- App may be backgrounded briefly
- Same as MO-01 — room survives

### MO-03 — Host locks phone while in lobby

- Host enters the lobby, then locks their phone
- After the screen timeout, the socket disconnects
- Room survives for 10 minutes
- Host unlocks phone; browser reconnects; host re-joins lobby

### MO-04 — Invited user opens link on slow mobile connection

- Invited user on a slow mobile connection opens the shared link
- The REST call to `GET /api/games/:gameId` takes several seconds
- The room is alive (host is connected or in grace period)
- Response arrives eventually; user sees the name entry screen

### MO-05 — Host shares link before entering nickname (pre-join scenario)

- Host creates game → navigates to `/game/:id/join` → uses browser share _before_ submitting the form
- `hostId` is still `null` on the server because no `game:join` has been emitted yet
- No player entry exists for the host's socket; disconnect handler scan finds nothing
- Room is NOT affected by the disconnect
- This scenario already works; confirm it continues to work after the fix

---

## Failure Scenarios

### FS-01 — Token unavailable on reconnect

- Host creates game, but `hostToken` is unavailable on reconnect because storage was cleared, blocked, unavailable, or never written
- Host refreshes or navigates away
- On re-entering the join screen, `hostToken` is not in Redux or `localStorage`
- Host submits `game:join` without a token
- Server rejects reconnect with `"Host reconnection requires a valid host token."`
- **Expected:** User sees error. Host must create a new game or proceed as a non-host player.
- **Risk:** Without a stored token, host reclaim is impossible in this phase. Document this limitation.

### FS-02 — Server restarts during grace period

- Host disconnects; 10-minute timer is running in memory
- Server process restarts (deployment, crash, restart)
- All in-memory state is lost
- Room is gone; invited players get `404`
- **Expected:** This is a known limitation of in-memory storage. Document it. Out of scope for this fix.

### FS-03 — Multiple clients trying to claim host simultaneously

- Host disconnects; two devices both attempt `game:join` with the same nickname and valid token
- First claim succeeds; `game.hostId` is updated
- Second claim finds the player already reconnected or the host role already reclaimed
- Second attempt is rejected or treated as "nickname already taken"
- **Expected:** Only the first reconnect succeeds; second is gracefully rejected.

### FS-04 — `host:offline` event arrives before player has joined the room

- Invited user is on the name entry screen and not yet in the Socket.IO room
- Host disconnects while user is filling in their name
- `host:offline` is emitted to the game room; invited user has not yet joined that room
- User submits `game:join` and enters the lobby, then sees the lobby in offline-host state
- **Expected:** User joins successfully; lobby shows host-offline state; no flash or incorrect state

### FS-05 — `game:closed` (`host_timeout`) arrives while user is on join screen

- Host's 10-minute timer fires while an invited user is still on the name entry screen
- `game:closed` is emitted to the room; the user may not be in the room yet
- User submits `game:join`; server returns `join:error: "Game not found."`
- **Expected:** User sees join error; client handles it gracefully and offers redirect to home

---

## Manual QA Checklist

### Setup

- [ ] Start the server in development mode
- [ ] Open two browser windows or devices (host and player)
- [ ] Create a game as the host and copy the join URL

### Core Fix

- [ ] Host creates game and enters the lobby
- [ ] Disconnect host's network or kill host's browser tab
- [ ] Wait 5 seconds
- [ ] Player opens the join URL — verify `200` response and name entry screen renders
- [ ] Player enters nickname and joins — verify they enter the lobby
- [ ] Reconnect the host (restore network or reopen tab)
- [ ] Host re-enters their name on the join screen with the same nickname
- [ ] Verify host re-enters lobby as host (start button appears)
- [ ] Verify all players see `host:reconnected` notification

### Grace Period Expiry

- [ ] Host creates game and enters the lobby
- [ ] Disconnect host (terminate socket connection)
- [ ] Wait 10 minutes, or temporarily reduce `HOST_RECONNECT_MS` for testing
- [ ] Verify player receives `game:closed` with `reason: "host_timeout"`
- [ ] Verify player is redirected to home
- [ ] Verify `GET /api/games/:gameId` returns `404`

### Page Refresh

- [ ] Host creates game and navigates to the join screen
- [ ] Without entering nickname, refresh the browser
- [ ] Verify `hostToken` is present after refresh (check app state or `localStorage`)
- [ ] Enter nickname and join; verify host role is correctly assigned

### Mobile Share Flow (manual, on device)

- [ ] Host on iOS Safari creates game
- [ ] Use Safari's share sheet to copy/share the link
- [ ] Verify host can re-enter the lobby successfully after the share sheet closes
- [ ] On a separate device, open the shared link
- [ ] Verify `200` response and name entry screen

### Lobby Reconnect (Ghost Prevention)

- [ ] Host creates game and enters the lobby
- [ ] Simulate socket reconnect (disable/re-enable network, or force-disconnect socket in DevTools)
- [ ] Verify lobby detects the reconnect and triggers re-join (auto or prompted)
- [ ] Verify host can click "Start Game" successfully after reconnect (not silently blocked)
- [ ] Repeat for a non-host player — verify they also rejoin and appear in the player list

### Explicit Leave (regression)

- [ ] Host creates game and enters lobby
- [ ] Host clicks the current explicit leave/close control
- [ ] Verify `game:closed` is emitted immediately (no grace period)
- [ ] Verify room is deleted immediately

### Token Security

- [ ] Join as a non-host with the host's nickname but without a valid token
- [ ] Verify `join:error: "Host reconnection requires a valid host token."`
- [ ] Verify room is not affected

---

## Suggested Automated Test Cases

### Server — `server/socket/index.js` disconnect handler

```txt
describe('disconnect handler — waiting + host')
  test: should NOT call deleteGame immediately when host disconnects in waiting state
  test: should set hostDisconnectedAt on the game object
  test: should call setExpiryTimer with HOST_RECONNECT_MS (10 min)
  test: should emit host:offline to the game room
  test: should NOT emit game:closed at disconnect time

describe('disconnect handler — waiting + non-host')
  test: should NOT delete the room (unchanged behaviour)
  test: should emit lobby:updated
  test: should NOT emit host:offline

describe('expiry timer callback')
  test: should emit game:closed with reason "host_timeout" when timer fires
  test: should call deleteGame after expiry
```
