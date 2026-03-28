description: Generate an implementation-ready feature spec and save it to \_plan
argument-hint: [feature request]

---

You are creating an implementation-ready feature spec for this project.

Use the project's existing instructions, conventions, and engineering guidelines already established in the current context. Do not restate them unless they are directly relevant to the feature.

Your job is to take the user's request and turn it into a clear, practical, build-ready spec that is immediately useful for implementation.

The user may provide:

- a feature name
- a rough idea
- a sentence describing the desired outcome
- a bug or product problem
- a workflow they want supported
- a refactor target
- a UI, backend, auth, admin, API, database, or integration request

If the request is vague, incomplete, or mixed, do not block progress. Infer the most reasonable scope, clearly label assumptions, and continue.

## Instructions

1. Interpret the request as a real product or engineering task.
2. Produce a spec that is implementation-ready, practical, and clearly scoped.
3. Optimize for execution, not theory.
4. Include enough detail that coding can begin without rethinking the requirement from scratch.
5. Keep wording crisp, concrete, and low-noise.
6. Prefer plain English over jargon.
7. Include both product behavior and technical implications when useful.
8. If the request touches auth, roles, permissions, routing, data flow, APIs, UI states, or persistence, explicitly cover them.
9. If the request implies validation, loading, empty, error, unauthorized, forbidden, duplicate-action, or failure states, include them.
10. Separate required behavior from assumptions.
11. Avoid inventing unnecessary complexity.
12. Save the spec as a new markdown file inside `_plan/`.
13. Use a kebab-case filename based on the feature name or best summary of the request.

## Output format

Write the spec in markdown using exactly this structure:

# [Feature Title]

## Summary

A short paragraph explaining what is being built or changed and why.

## Goal

What success looks like.

## Non-Goals

What is explicitly out of scope for this task.

## Problem

What problem this feature solves.

## Users / Actors

Who interacts with this feature.

## Core Requirements

A numbered list of the required behaviors.

## User Flows

Step-by-step flows for the main scenarios.

## Functional Details

Concrete behavior grouped by area as needed, such as:

- UI / pages / components
- routing / navigation
- authentication / authorization
- backend behavior
- API endpoints
- validation
- database changes
- notifications
- analytics
- integrations

Only include sections that are relevant to the request.

## States and Edge Cases

List important states, edge cases, and failure conditions.

## Technical Notes

Important implementation guidance, dependencies, constraints, and architecture notes relevant to this feature.

## Acceptance Criteria

Use a checklist with concrete, testable outcomes.

## Open Questions

List only true unknowns that still need confirmation.
If there are none, say:

- None at this stage.

## Assumptions

List any assumptions made due to missing detail.
If there are none, say:

- None.

## File Naming

Use this pattern for the saved spec file:
`_plan/<feature-name>.md`

## Quality Bar

The spec must be:

- specific
- implementation-ready
- testable
- scoped
- readable
- reusable across projects

Now generate the spec based on the user's request and save it to `_plan/`.
