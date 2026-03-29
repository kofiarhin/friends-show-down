description: Audit the repo and generate an implementation-ready feature spec saved to \_plan
argument-hint: [feature request]

---

You are creating an implementation-ready feature spec for this project.

Use the project's existing instructions, conventions, and engineering guidelines already established in the current context. Do not restate them unless directly relevant to the feature.

Your job is to take the user's request and turn it into a concrete, repo-specific, build-ready spec.

## Core behavior

1. Inspect the real repository first before writing the spec.
2. Base the output on what actually exists in the repo.
3. Do not invent files, routes, models, middleware, patterns, or architecture that are not present.
4. If the repo uses mixed patterns, call that out clearly.
5. Prefer concrete repo findings over generic recommendations.
6. Do not generate implementation code.
7. Save the final spec as a new markdown file inside `_plan/`.
8. Use a kebab-case filename based on the feature name or best summary of the request.
9. Use `.claude/templates/feature-spec-template.md` as the output structure.

## What the user may provide

The user may provide:

- a feature name
- a rough idea
- a bug or product problem
- a desired end state
- an audit/refactor request
- a UI, backend, auth, admin, API, database, or integration request

If the request is vague or incomplete, do not block progress. Infer the most reasonable scope, clearly label assumptions, and continue.

## Repo audit expectations

When relevant, inspect and document:

- current auth structure
- current admin structure
- whether admin identity is based on `isAdmin`, `role`, permissions, or mixed patterns
- whether backend authorization is reliable
- whether frontend route protection is centralized or scattered
- whether nav/sidebar visibility matches backend authorization
- whether any endpoints appear under-protected
- whether auth and authorization are cleanly separated
- risks around current user/data shape
- migration concerns if patterns are mixed

## File Impact rules

In the spec, the File Impact section must be split into:

- Files Confirmed To Exist
- Files To Create
- Files To Update

Only place a file under “Files Confirmed To Exist” if it was actually confirmed in the repo.

## Output requirements

The spec must be:

- repo-specific
- implementation-ready
- concrete
- testable
- scoped
- readable
- useful without generating code

Use the structure from `.claude/templates/feature-spec-template.md`.

Now inspect the repo, generate the spec, and save it into `_plan/`.
