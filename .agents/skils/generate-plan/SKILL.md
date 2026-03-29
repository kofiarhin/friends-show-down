---
name: generate-plan
description: Use this when the user provides a detailed implementation spec and wants a practical execution plan saved into _plan in the current repository.
---

When this skill is invoked, treat the user's message as the source implementation spec.

You must not stop at chat output only. You must save the generated plan into the repository.

Required workflow:

1. Read the full spec text from the user's message.
2. Inspect the current repository to understand the actual stack, architecture, file structure, naming conventions, and implementation patterns.
3. Generate a detailed implementation plan tailored to this codebase.
4. Write the generated plan to a temporary markdown file named `temp-plan.md` in the project root.
5. Run this command exactly:
   `node .agents/skills/generate-plan/scripts/save-plan.js "generated plan" temp-plan.md`
6. Confirm the final saved file path inside `_plan/`.
7. Delete `temp-plan.md` after the save succeeds.
8. End by reporting the exact saved file path.

Hard requirements:

- Do not leave the plan only in the chat response.
- You must create `_plan/` if it does not exist.
- You must save the final output as a markdown file inside `_plan/`.
- You must use the save script.
- If saving fails, fix the path or command and retry.
- Only finish after the file exists in `_plan/`.

Write the plan using this structure:

# Title

## Source spec

Summarize the feature and implementation target.

## Codebase context

Relevant architecture and constraints discovered in the repository.

## Assumptions

Important assumptions for execution.

## Implementation phases

High-level phases in the correct build order.

## Detailed task breakdown

Concrete step-by-step work items.

## Files likely to change

List likely frontend, backend, config, and test files.

## Risks and blockers

Potential issues, dependencies, or unclear areas.

## Validation checklist

What must be verified during implementation.

## Testing checklist

What to test before considering the work done.

## Done criteria

Concrete completion conditions.
