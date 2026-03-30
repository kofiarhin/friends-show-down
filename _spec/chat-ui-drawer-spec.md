# Game Chat UI - Minimal Drawer Spec

## Goal

Improve the in-game chat experience so it remains available and socially visible without distracting from active trivia gameplay.

The recommended solution is a **smart minimalist chat drawer**:

- a compact minimized chat control during active play
- an expandable drawer for full conversation access
- an unread indicator and brief preview when minimized
- a responsive desktop and mobile layout

## Why this feature

The current chat panel is too large for the play screen and competes with answer selection. Players should not have to sacrifice gameplay focus for chat visibility.

This spec makes chat:

- less intrusive during questions
- still discoverable
- still easy to open and use
- consistent with the dark multiplayer trivia theme

## Scope

### In scope

- Client-only UI change
- New chat drawer component or wrapper
- Minimized chat control on the game screen
- Expandable chat drawer on demand
- Unread count indicator
- Conditional chat input availability during active question rounds
- Responsive behavior for desktop and mobile

### Out of scope

- Backend changes
- New socket events
- Chat message format changes
- Full chat redesign beyond the gameplay screen

## UX behavior

### Default gameplay state

During active gameplay, the chat should render as a small, unobtrusive control instead of a full fixed panel.

- Desktop: a compact right-side pill or bubble
- Mobile: a floating bottom corner toggle
- The control shows an unread badge and last message preview when available
- Chat input is hidden or disabled while questions are live

### Expanded chat state

When the player opens chat, show a drawer that contains:

- header with title and close button
- scrollable message list
- sticky input footer when chat is enabled
- clear message ownership styling for the current user and others

### Read-only / disabled live state

While a question is live:

- the minimized control remains interactive
- the drawer can open to read messages
- the input should indicate chat is unavailable or read-only
- the UI should avoid covering answer buttons

### Lobby / results state

Outside active play, chat can open by default or remain expanded to encourage social interaction.

## Design details

### Minimized control

The minimized state should include:

- chat icon
- unread message badge
- optional one-line preview of the latest message or status text
- subtle animation on new messages

### Expanded drawer

The expanded drawer should:

- slide in from the right on desktop
- slide up from the bottom on mobile
- have a semi-transparent dark backdrop on desktop if it overlays game content
- use a dark background with indigo highlights to match the existing theme

### Message UI

Message styling should be:

- own messages: right-aligned, indigo background
- others: left-aligned, gray background
- message timestamps can be shown on hover or in a lighter caption
- author labels can be shown once per sender grouping

### Responsive layout

#### Desktop

- main gameplay area should reclaim space previously used by the fixed chat panel
- the minimized control lives at the right edge
- expanded drawer is 350–420px wide and does not fully obscure the play area

#### Mobile

- minimized control is a floating button at the bottom-right
- expanded drawer occupies bottom 55–70% of the viewport
- the drawer should still allow players to see enough of the game behind it

## Implementation notes

### Component structure

- `client/src/components/ChatDrawer.jsx`
  - wrapper component for minimized/expanded states
  - manages toggle state
  - renders chat control and drawer layout

- `client/src/components/ChatPanel.jsx`
  - reuse existing message rendering
  - support a compact or full layout mode
  - expose props for `enabled` and `readOnly`

- `client/src/screens/GameScreen.jsx`
  - move chat into the new drawer wrapper
  - remove or reduce the fixed chat grid cell
  - allow gameplay content to take more horizontal space

### Behavior rules

- The minimized control should not interrupt active questions.
- The drawer may open during active questions but should clearly indicate chat input is unavailable.
- New message count should be visible while minimized.
- If a message arrives while minimized, the drawer icon should animate subtly.

### Implementation risks

- Avoid moving chat into a location that interferes with answer buttons.
- Avoid forcing the user to close chat manually after every question.
- Keep the implementation small: this is a presentation-layer change only.

## Acceptance criteria

- Chat renders as a compact, non-intrusive control during active gameplay.
- Players can open a full chat drawer on demand.
- Unread messages are indicated clearly when chat is minimized.
- Chat input is disabled or visually unavailable while questions are live.
- The play screen regains layout space previously occupied by the fixed chat panel.
- No backend or socket protocol changes are required.

## Testing plan

### Visual / behavior tests

- verify the minimized chat control appears on `GameScreen`
- verify the chat drawer expands and collapses correctly
- verify unread badge updates when new chat messages arrive while minimized
- verify the input area is disabled or hidden during active questions
- verify the drawer is usable on desktop and mobile widths

### Unit / component tests

- `ChatDrawer` toggles between minimized and expanded states
- `ChatPanel` renders correctly in compact and expanded modes
- `GameScreen` layout includes the drawer wrapper instead of a fixed panel

### Manual QA scenarios

- open chat during a question and verify it does not block answer buttons
- receive new chat messages while chat is minimized and confirm badge updates
- open chat in lobby and confirm input is enabled immediately
- collapse chat after sending a message and verify the game area regains visibility
