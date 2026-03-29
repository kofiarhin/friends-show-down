# CLAUDE.md

## Purpose

This file defines the engineering standards, architecture defaults, workflow rules, and output expectations for this project.

All generated code, refactors, bug fixes, tests, and feature work must follow these instructions strictly.

The default goal is not just working code. The goal is production-ready, maintainable, testable, scalable, and safe-to-deploy code that can be extended without unnecessary rewrites.

Development configuration must mirror production architecture as closely as practical. Avoid local-only shortcuts that change how networking, endpoint resolution, or application behavior works between environments.

---

## Production-Ready Code Standard

All code must be written with a production mindset by default.

This means:

- Code must be clear, maintainable, and safe to extend
- Code must handle failure states explicitly
- Code must avoid fragile shortcuts and hidden side effects
- Code must be structured for real-world usage, not toy examples
- Code must be ready for testing, debugging, and future iteration
- Code must be copy-paste ready and runnable within the project structure
- Code must behave consistently across local, staging, and production environments

Do not generate placeholder architecture disguised as finished implementation.

Do not optimize only for brevity if it reduces clarity, safety, maintainability, or deployment reliability.

---

## Core Development Mindset

- Build with a production-leaning mindset at all times
- Prefer clarity over cleverness
- Prefer explicit logic over hidden behavior
- Prefer maintainability over shortcuts
- Keep implementations modular and practical
- Keep code concise, but never at the cost of correctness
- Avoid unnecessary abstractions
- Avoid speculative patterns unless the project clearly needs them
- Return complete, usable work
- When fixing code, return full updated files unless asked otherwise
- Prioritize speed, clarity, correctness, deployment safety, and long-term maintainability

---

## Definition of Production-Ready

Code is considered production-ready only if it meets the following expectations:

### Correctness

- The implementation solves the requested problem fully
- Edge cases are handled where relevant
- Inputs are validated where appropriate
- Async flows are handled safely
- No obvious race conditions, stale state issues, or silent failures

### Maintainability

- Files have clear responsibilities
- Business logic is separated from UI and transport concerns
- Naming is consistent and readable
- The codebase remains easy to extend without rewriting core pieces

### Reliability

- Errors are handled explicitly
- Empty states, loading states, and failure states are accounted for
- APIs return predictable response shapes
- Backend logic does not trust client input
- Frontend logic does not assume successful server responses
- Network configuration is explicit and environment-driven

### Testability

- Code is structured so it can be tested without hacks
- New behavior should include or update tests
- Tests should cover meaningful behavior, not implementation trivia

### Security and Safety

- Secrets must come from environment variables
- Sensitive values must never be hard-coded
- Inputs must be validated
- Unsafe defaults must be avoided
- Do not expose internal-only data unnecessarily

### Scalability

- Avoid patterns that break down as data or UI complexity grows
- Paginate large datasets where relevant
- Avoid tightly coupling unrelated concerns
- Design modules so new features can be added cleanly

---

## Non-Negotiable Engineering Rules

- Never hard-code secrets, tokens, credentials, or private keys
- Never hard-code environment-dependent endpoints, ports, origins, or base URLs
- Never rely on Vite proxy as the primary API communication strategy
- Never trust client input on the backend
- Never swallow errors silently
- Never leave unhandled promise rejections
- Never mix server state into Redux
- Never place API request logic directly inside React components
- Never make components responsible for heavy business logic
- Never return incomplete code presented as production-ready
- Never use fake placeholders unless explicitly requested
- Never add unnecessary comments that explain obvious code
- Never introduce libraries or abstractions without clear need

---

## Default Stack

### Frontend

- React with the latest Vite setup by default
- Tailwind CSS by default
- Vitest for frontend testing
- React Router for routing
- TanStack Query for server state
- Redux Toolkit for global client state only

### Backend

- Node.js
- Express
- MongoDB with Mongoose
- Jest for backend testing
- Supertest for API testing

### General

- Use `.env` for secrets and environment variables
- Never hard-code secrets
- Keep `package.json` at the project root by default
- Preferred root structure:

```txt
package.json
client/
server/
```
