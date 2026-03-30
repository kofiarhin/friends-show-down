import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import HomeScreen from "./screens/HomeScreen";
import NameEntryScreen from "./screens/NameEntryScreen";
import LobbyScreen from "./screens/LobbyScreen";
import GameScreen from "./screens/GameScreen";
import ResultsScreen from "./screens/ResultsScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import Header from "./components/Header";
import { hydrateSession } from "./store/gameSlice";
import { loadGameSession } from "./utils/gameSessionStorage";

function SessionHydrator() {
  const dispatch = useDispatch();
  const isHydrated = useSelector((state) => state.game.isHydrated);

  useEffect(() => {
    if (isHydrated) return;
    dispatch(hydrateSession(loadGameSession()));
  }, [dispatch, isHydrated]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionHydrator />
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
