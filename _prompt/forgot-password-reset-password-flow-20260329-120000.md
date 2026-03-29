# Add forgot password and reset password flow

## Task

Add a secure forgot password / reset password flow to the `Friends Showdown` application, including backend REST endpoints, frontend screens, token handling, and validation.

## Goal

Allow users who have lost access to their account password to request a password reset link and set a new password securely without exposing account existence or sensitive data.

## Project assumptions

- The repo currently uses a Vite + React frontend and an Express backend.
- There is currently no existing account/password authentication flow in the app.
- Game state is managed via sockets and Redux; this feature should not disrupt existing lobby/game flows.
- Use the existing backend patterns for request validation, error handling, and consistent response shapes.
- Email delivery can be implemented as a stub or debug transport for now if a real SMTP provider is not available.

## Functional requirements

- Backend:
  - `POST /api/auth/forgot-password`
    - Accepts `{ email: string }`.
    - Validates input.
    - If the email exists, generate a secure reset token, store it with expiry, and send a reset link to the user.
    - Always return a generic success response so callers cannot infer whether the email exists.
  - `POST /api/auth/reset-password`
    - Accepts `{ token: string, newPassword: string }`.
    - Validates the token, checks expiry, and replaces the stored password hash.
    - Invalid or expired tokens return a 400-class error.
  - Optionally add `GET /api/auth/validate-reset-token?token=...` for frontend token validation before rendering the reset form.
- Frontend:
  - Add a `ForgotPasswordScreen` at `/forgot-password`.
  - Add a `ResetPasswordScreen` at `/reset-password?token=...`.
  - Provide a form for email submission and a separate form for new password entry.
  - Show clear success and error messages for both steps.
  - Preserve the existing app layout and styling conventions.
- Security:
  - Hash passwords using a safe algorithm like `bcrypt`.
  - Generate reset tokens using a cryptographically secure random string.
  - Store only the hashed password and reset token metadata.
  - Enforce a token expiration window (e.g. 1 hour).
  - Do not leak whether an email address exists in the system.

## Non-functional requirements

- Input validation must return 400 errors for malformed requests.
- Password validation should reject empty or too-short values.
- Reset token expiry should be enforced consistently.
- Maintain the current app architecture: no new global client state unless needed.
- Keep the implementation minimal and isolated to auth-related files.

## Backend considerations

- Add a new `server/routes/auth.js` router for auth endpoints.
- Add or extend a `server/store/userStore.js` to hold user records and password reset metadata.
- If persistence is not available, keep the store in memory for now but design it so a database can be added later.
- Use a token generation helper in `server/utils/` if needed.
- Add a simple email service stub under `server/utils/emailService.js` or use environment-driven configuration.
- Add tests for auth routes and user store behavior.

## Frontend considerations

- Add new screens under `client/src/screens/ForgotPasswordScreen.jsx` and `client/src/screens/ResetPasswordScreen.jsx`.
- Add route definitions in `client/src/App.jsx` or wherever app routing is configured.
- Add API helper functions in `client/src/api/auth.js` or reuse existing config.
- Use local component state and proper form validation.
- Reuse existing button and form styling patterns from the app.

## Data model changes

- User record:
  - `id: string`
  - `email: string`
  - `passwordHash: string`
  - `resetToken?: string`
  - `resetTokenExpiresAt?: number`
- If user sign-up does not exist yet, add a minimal user creation path in the auth store so the feature can be tested.

## API changes

- `POST /api/auth/forgot-password`
  - Request: `{ email: string }`
  - Response: `{ message: string }`
- `POST /api/auth/reset-password`
  - Request: `{ token: string, newPassword: string }`
  - Response: `{ message: string }`
- Optional: `GET /api/auth/validate-reset-token?token=...`
  - Response: `{ valid: boolean }`

## Edge cases

- Empty or invalid email on forgot-password.
- Empty, missing, or weak new password.
- Invalid or expired reset token.
- Reuse of a token after it has already been consumed.
- Requests with no token present in the reset URL.
- Email delivery failure when using a real email provider.
- The user enters a valid-looking token but the account has no matching reset record.

## Testing requirements

- Backend tests for:
  - `POST /api/auth/forgot-password` with valid email.
  - `POST /api/auth/forgot-password` with unknown email returns generic success.
  - `POST /api/auth/reset-password` with valid token updates password.
  - `POST /api/auth/reset-password` rejects expired or invalid tokens.
  - Token cannot be reused after reset.
- Frontend tests for:
  - `ForgotPasswordScreen` success and validation errors.
  - `ResetPasswordScreen` success flow and token-related errors.
  - Route rendering when `token` query param is missing.

## Acceptance criteria

- The app exposes a working forgot-password endpoint.
- The app exposes a working reset-password endpoint.
- Users can request a reset link and set a new password with a token.
- Passwords are hashed and reset tokens expire.
- The frontend shows the correct forms and messages.
- Existing game and socket behavior remain unchanged.

## Constraints

- Do not refactor the existing game socket flows.
- Keep the new auth flow isolated to auth-specific files.
- Avoid introducing new global Redux state unless required by the feature.
- Keep the implementation compatible with the existing Express/Vite monorepo.
