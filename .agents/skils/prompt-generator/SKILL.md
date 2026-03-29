---
name: prompt-generator
description: Expand a short feature request into a detailed implementation prompt and save it under _prompt/ in the project root.
---

When the user gives a short software request, convert it into a detailed implementation prompt.

Requirements:

- Adapt the prompt to the user's request.
- Save output into `_prompt/` at the project root.
- Create `_prompt/` if it does not exist.
- Use a kebab-case filename plus timestamp.
- Save as markdown.

Prompt structure:

- Task
- Goal
- Project assumptions
- Functional requirements
- Non-functional requirements
- Backend considerations
- Frontend considerations
- Data model changes
- API changes
- Edge cases
- Testing requirements
- Acceptance criteria
- Constraints

Workflow:

1. Generate the prompt content in markdown.
2. Save that markdown temporarily as `temp-prompt.md` in the project root.
3. Run:
   `node .agents/skills/prompt-generator/scripts/save-prompt.js "$ARGUMENTS" temp-prompt.md`
4. After saving successfully, delete `temp-prompt.md`.
5. Report the final saved file path.
