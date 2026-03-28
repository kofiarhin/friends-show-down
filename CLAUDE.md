# CLAUDE.md

## Purpose

This file defines the coding rules, architecture defaults, workflow, and output standards for this project.
All generated code, refactors, bug fixes, and feature work must follow these instructions.

---

## Core Development Mindset

- Build with a production-leaning mindset.
- Prefer clean, modular, maintainable code over clever shortcuts.
- Keep implementation practical and copy-paste ready.
- Do not add fluff, filler comments, or unnecessary abstractions.
- When fixing code, return full updated files unless asked otherwise.
- Optimize for speed, clarity, and correctness.

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
