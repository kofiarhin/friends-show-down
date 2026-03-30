import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomeScreen from "./screens/HomeScreen";
import NameEntryScreen from "./screens/NameEntryScreen";
import LobbyScreen from "./screens/LobbyScreen";
import GameScreen from "./screens/GameScreen";
import ResultsScreen from "./screens/ResultsScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import Header from "./components/Header";

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/game/:gameId/join" element={<NameEntryScreen />} />
        <Route path="/game/:gameId/lobby" element={<LobbyScreen />} />
        <Route path="/game/:gameId/play" element={<GameScreen />} />
        <Route path="/game/:gameId/results" element={<ResultsScreen />} />
        <Route path="/leaderboard" element={<LeaderboardScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
