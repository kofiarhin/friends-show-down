import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomeScreen from "./screens/HomeScreen";
import NameEntryScreen from "./screens/NameEntryScreen";
import LobbyScreen from "./screens/LobbyScreen";
import GameScreen from "./screens/GameScreen";
import ResultsScreen from "./screens/ResultsScreen";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/game/:gameId/join" element={<NameEntryScreen />} />
        <Route path="/game/:gameId/lobby" element={<LobbyScreen />} />
        <Route path="/game/:gameId/play" element={<GameScreen />} />
        <Route path="/game/:gameId/results" element={<ResultsScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
