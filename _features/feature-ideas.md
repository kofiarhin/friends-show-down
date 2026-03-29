# Friends Showdown — Feature Ideas

These five enhancements are designed to make the game more engaging and fun to play while fitting the current React + Socket.IO architecture.

## 1. Bonus Round / Double-Point Questions

- Add a special `bonus` question type in the server question flow.
- On the backend, tag every 3rd or 5th question as `bonus` and award 2 points for the first correct answer.
- On the client, show a visual badge and update scoring copy to signal the higher-stakes round.
- Implementation notes:
  - `server/socket/handlers/gameHandlers.js` -> `emitQuestion()` can include `questionType` or `isBonus`
  - `client/src/store/gameSlice.js` and `client/src/screens/GameScreen.jsx` can render the bonus label

## 2. Streak / Combo Meter

- Track consecutive correct answers per player, e.g. `player.streak`.
- Reward streaks with extra score or visual flair (`3x combo`, `hot streak`).
- Surface streaks in the lobby leaderboard and results screen.
- Implementation notes:
  - Extend player objects in `server/store/gameStore.js`
  - Update question result logic in `server/socket/handlers/questionHandlers.js`
  - Show streak counts in `client/src/components/PlayerList.jsx` or `MiniLeaderboard.jsx`

## 3. Lobby Reactions / Live Cheers

- Add a lightweight lobby chat/reaction system so players can send emoji during waiting.
- Keep it simple: 3-4 buttons like 👍, 🤯, 🚀, 😄.
- Broadcast reactions with a socket event such as `lobby:reaction`.
- Implementation notes:
  - Add a new socket event handler in `client/src/screens/LobbyScreen.jsx`
  - Listen for reactions in `client/src/hooks/useSocketEvents.js`
  - Render a small animated reaction feed in the lobby UI

## 4. Surprise Challenge / Random Modifier Round

- Occasionally inject a surprise modifier: `speed round`, `no wrong answers`, or `double-answer bonus`.
- Show the modifier before the round begins and make the next question feel different.
- Implementation notes:
  - Add a `roundModifier` field to game session state in `server/store/gameStore.js`
  - Emit modifier info in `server/socket/handlers/gameHandlers.js` / `emitQuestion()`
  - Display modifier text in `client/src/screens/GameScreen.jsx`

## 5. Animated End Game Celebration

- Make the final results screen more rewarding with confetti, winner animation, or rank badges.
- Add a summary section for `top scorer`, `fastest correct answer`, or `most consistent player`.
- Implementation notes:
  - Enhance `client/src/screens/ResultsScreen.jsx` with extra UI elements
  - Use data from `server/socket/handlers/gameHandlers.js` `game:end` payload
  - Optionally add small CSS animation classes in `client/src/App.css`

---

These ideas are low-risk and fit naturally into the existing codebase. They can be implemented incrementally and will make the game feel more interactive and social.
