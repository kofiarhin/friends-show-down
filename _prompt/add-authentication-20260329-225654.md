# Add authentication

## Task
Add authentication to Friends Showdown so that game creation, joining, and host actions require a verified user identity instead of relying solely on open links and nickname-based session joins.

## Goal
Enable authenticated users to register, log in, and maintain a secure session while preserving the existing real-time multiplayer game flow. Enforce server-side authorization for all protected REST and Socket.IO actions.

## Project assumptions
- Existing frontend is React/Vite with Redux Toolkit for local state and socket-driven app state.
- Backend is Express + Socket.IO with in-memory game state in `server/store/gameStore.js`.
- Current app has no account or auth system; game flows rely on shared game links and nickname uniqueness only.
- The implementation should avoid broad refactors and preserve the current game/session lifecycle as much as possible.
- `VITE_API_URL` is the source of truth for REST requests on the client.
- A lightweight auth implementation may use JWT or HTTP-only cookies and should be compatible with existing dependencies.

## Functional requirements
- Add registration and login UI flows on the client.
- Add backend auth endpoints for register, login, logout, and session verification.
- Protect `POST /api/games` and any game session validation routes so only authenticated users can create or validate games.
- Require authenticated identity for socket join and host actions.
- Keep the existing nickname flow for display, but associate each player with a server-verified user account.
- Persist auth state on the client across reloads and restore it before socket connection or game navigation.
- Ensure host designation is derived server-side from authenticated session data.

## Non-functional requirements
- Do not expose raw passwords in requests, logs, or client state.
- Use secure storage for tokens / session cookies; prefer HTTP-only cookies or secure local storage patterns as appropriate.
- Keep auth changes minimal and orthogonal to existing game mechanics.
- Fail fast on invalid or missing auth tokens, returning appropriate 401/403 responses.
- Keep current socket event contracts stable when auth is present.

## Backend considerations
- Add `server/routes/auth.js` or extend `server/routes/games.js` with auth routes.
- Add auth middleware that validates a JWT or session token on protected routes and socket handshakes.
- Use an `AUTH_SECRET` environment variable and validate it at startup.
- Decide whether to persist users in MongoDB via the existing `mongoose` dependency or use a minimal in-memory user store for v1.
- Store user accounts with `userId`, `email`/`username`, hashed password, and optional display name.
- Bridge authenticated user identity to game session membership and host assignment.
- Avoid trusting client-side `isHost` or role flags; derive host status from stored user/session data.

## Frontend considerations
- Add a login/register screen or modal before game creation/join flows.
- Manage auth state in Redux or a dedicated auth slice, separate from the socket-driven game state.
- Persist user session safely and restore it on page load.
- Update existing `HomeScreen` and join flow to require auth before creating or joining a room.
- Provide clear errors for invalid credentials, expired sessions, and unauthorized game actions.

## Data model changes
- Add a `User` model or user store with fields:
  - `userId`
  - `email` or `username`
  - `passwordHash`
  - `createdAt`
  - `nickname` or `displayName` (optional)
- Associate socket-connected players with a verified `userId`.
- Preserve game session fields in `gameStore.js` but add `userId` to player records internally.

## API changes
- New endpoints:
  - `POST /api/auth/register` → register a new account
  - `POST /api/auth/login` → authenticate and return a token/session cookie
  - `POST /api/auth/logout` → revoke or clear auth state
  - `GET /api/auth/me` → verify current session and return user identity
- Protect existing game endpoints and socket auth flows with auth middleware.
- Add server-side validation for auth payloads and return 400/401 for bad input.

## Edge cases
- Duplicate registration identifiers.
- Invalid login credentials.
- Expired or malformed tokens.
- Authenticated user attempts to join a game with a nickname that's already in use.
- Authenticated host reconnects after disconnect with a stale socket ID.
- Unauthorized socket emits for `game:start`, `answer:submit`, or other game actions.
- Guest access attempts to protected routes or socket events.
- Auth state lost on page refresh.

## Testing requirements
- Add backend Jest tests for auth routes and middleware.
- Test protected game creation and validation paths reject unauthenticated requests.
- Test socket handshake / join flows with and without valid auth.
- Test duplicate email/username registration and invalid login.
- Test client auth state persistence and restore behavior.
- Test unauthorized host actions are rejected.

## Acceptance criteria
- Users can register and log in before creating or joining a game.
- Protected backend routes reject unauthenticated requests with 401/403.
- Socket-based game joins and host actions are only accepted for authenticated users.
- Auth state persists safely across reloads.
- Existing game flow still works for authenticated players with minimal visible changes beyond the auth requirement.

## Constraints
- Avoid introducing a major data persistence migration unless auth requires it.
- Preserve the current real-time Socket.IO architecture.
- Do not change the public `game:*` and `question:*` event contracts if auth can be layered transparently.
- Use environment variables for secrets rather than hard-coded keys.
