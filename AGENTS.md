# AGENTS.md

## Repo rules

- Frontend: React (Vite)
- Styling: Tailwind by default
- Server state: TanStack Query only
- Global client state only: Redux Toolkit
- Do not duplicate server data in Redux
- Keep API logic out of components
- Keep components focused on rendering and interaction
- Follow the existing project structure and naming conventions
- Do not introduce unnecessary refactors
- Keep fixes minimal, safe, and production-ready

## Backend rules

- Never trust client authority flags such as `isHost`, `isAdmin`, `role`, or ownership indicators
- All authorization decisions must be derived server-side
- Validate request body, params, and query before use
- Invalid client input must return 400-class errors, not 500s
- Keep API response shapes consistent
- Do not break existing API contracts unless required for the fix
- Enforce schema integrity and validation on the backend
- Add or update Jest tests for every backend behavior change

## Socket rules

- Never destructure untrusted payloads directly
- Guard payloads before accessing nested properties
- Treat join, reconnect, and event payloads as untrusted input
- Never allow the client to self-assign authority
- Host or owner restoration must be verified using server-issued credentials only
- Prevent duplicate listeners and clean up subscriptions properly
- Handle reconnect flows defensively and explicitly

## Testing rules

- Frontend tests: Vitest
- Backend tests: Jest
- Test edge cases, not just happy paths
- Cover invalid input
- Cover unauthorized actions
- Cover reconnect and recovery scenarios
- Cover stale or malformed payloads
- Cover race conditions where relevant
- Fix failing tests or update stale tests to match correct behavior, but do not blindly rewrite tests to force passing results

## Execution rules

- Prefer the smallest safe fix
- Do not add new abstractions unless necessary
- Do not rename files, functions, or modules unless required
- Do not touch unrelated logic
- Prioritize work in this order:
  1. Security issues
  2. Correctness bugs
  3. Test alignment
  4. Cleanup only if necessary

## Output rules

- Return changed files first
- Return full updated code that is copy-paste ready
- Include a short summary of what changed and why
- Include any remaining risks or follow-up items only if they are real
