# Mobile Chat UI Plan

## Goal

Create a mobile-first chat UI for the trivia app that stays clean, readable, and bounded on small screens. The chat should be easy to open and dismiss, should not grow uncontrolled with players or message volume, and should preserve the gameplay area.

## Recommended Implementation

Use a compact bottom sheet-style chat panel with a fixed maximum height and a toggle control.

### Core behavior

- Render chat as a bounded panel that covers no more than 35–45% of viewport height on mobile.
- Keep the chat hidden or collapsed by default, with a small pill or button to open it.
- When opened, show:
  - header with title and close button
  - scrollable message list
  - sticky input row at the bottom
- Keep the panel separate from the game area so it never pushes gameplay content off-screen.
- Support easy dismissal by tapping a close button or swiping down.

### Message UI

- Use compact message bubbles with:
  - sender name + timestamp on one line
  - message text below
- Use subtle background contrast for readability and to separate messages.
- Keep line lengths short and use enough padding for touch-friendly scrolling.
- Auto-scroll to the latest message when the panel opens, but allow manual scroll for history.

### Input behavior

- Pin the input row to the bottom of the panel.
- Use a single-line text field plus a send button.
- Disable input and show helper text when chat is unavailable during active question rounds.

### Mobile-specific considerations

- Use a floating chat toggle on the gameplay screens:
  - visible but not intrusive
  - shows unread message count when chat is collapsed
- Expand the chat into a sheet instead of a full screen, keeping the game context visible.
- Keep the UI simple and lightweight to avoid visual clutter.

### Desktop considerations

- Use a WhatsApp-style desktop layout on larger screens:
  - left column: chat list / room list with small avatars, nicknames, and unread indicators
  - right column: active conversation panel with header, scrollable message feed, and sticky input row
- Keep the desktop chat as a fixed side panel or drawer that does not cover the entire game screen.
- Use a two-column layout for lobby/results screens where the chat panel occupies 30–35% of width and the game content remains visible.
- On desktop, show more chat history by default but still keep the message area scrollable and bounded; avoid making the whole page scroll with chat.
- Use WhatsApp-inspired message bubbles:
  - aligned left for other players, right for the current user
  - distinct bubble colors for sender vs local messages
  - light timestamps and sender names in the header of each grouped message block
- Keep the input area simple and fixed below the message feed, with a text field and send button.
- Use a responsive layout so the same chat panel collapses into the mobile bottom sheet on smaller viewports.

## Why this works

- The chat remains accessible without overwhelming the game screen.
- Bounded height prevents the panel from growing with more messages.
- A modal/overlay pattern on mobile feels familiar and easy to dismiss.
- The design scales with player count because the message list is scrollable inside a fixed container.

## Files to update

- `client/src/components/ChatPanel.jsx`
- `client/src/screens/LobbyScreen.jsx`
- `client/src/screens/GameScreen.jsx`
- `client/src/screens/ResultsScreen.jsx`
- `client/src/hooks/useSocketEvents.js`

## Next step

Implement the bounded mobile chat drawer and preserve the existing chat state flow. For the first iteration, keep the current chat event contract and focus on mobile layout improvements.
