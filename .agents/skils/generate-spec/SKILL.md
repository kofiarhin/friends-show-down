---
name: generate-spec
description: Use this when the user provides a detailed feature prompt and wants a codebase-aware implementation spec saved into _spec in the current repository.
---

When this skill is invoked, treat the user's message as the source feature prompt.

Goal:
Turn the pasted detailed feature prompt into a practical, codebase-aware implementation spec for this repository.

Workflow:

1. Read the full prompt text from the user's message.
2. Inspect the current repository before writing the spec.
3. Identify the real stack, folder structure, naming conventions, architecture patterns, routes, services, state management, and test setup already in use.
4. Generate a detailed implementation spec tailored to the actual codebase.
5. Create `_spec/` in the project root if it does not exist.
6. Save the generated spec as markdown inside `_spec/`.
7. Use a kebab-case filename derived from the main feature title or request, ending with `-implementation-spec.md`.
8. Report the final saved file path after completion.

Requirements:

- Use the pasted feature prompt as the source requirement.
- Base all implementation recommendations on the actual codebase, not generic assumptions.
- Keep the spec practical, implementation-focused, and aligned with existing patterns.
- Avoid unnecessary rewrites or architecture changes unless the prompt clearly requires them.
- Preserve current app behavior unless the requested feature requires a change.
- If the feature affects backend, frontend, routes, data, validation, sockets, or tests, cover those areas explicitly.
- If a section is not relevant, keep it brief rather than forcing content.

Write the spec using this structure:

# Title

## Source prompt

Summarize the requested feature clearly.

## Context

How this feature fits into the current codebase.

## Goals

What the implementation should achieve.

## Relevant codebase findings

Important files, modules, routes, components, services, state, and architecture patterns discovered during inspection.

## Scope

What should be included in the implementation.

## Out of scope

What should not be changed unless necessary.

## Implementation plan

Step-by-step plan for building the feature.

## Backend changes

Only if relevant.

## Frontend changes

Only if relevant.

## Data model changes

Only if relevant.

## API changes

Only if relevant.

## Validation and security considerations

Only if relevant.

## Edge cases

Realistic failure cases and constraints.

## Testing plan

What to test and where.

## Acceptance criteria

Concrete done conditions.

Output rules:

- Save the spec into `_spec/` at the repository root.
- Create `_spec/` if it does not exist.
- Save as a markdown file.
- Use a clean kebab-case filename based on the feature title or main request.
- End the response by stating the exact saved file path.
