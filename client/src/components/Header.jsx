import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="w-full bg-gray-900 border-b border-gray-800 px-6 py-4">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded"
      >
        Skip to main content
      </a>
      <Link to="/" className="text-white font-bold text-lg tracking-wide hover:text-indigo-400 transition">
        Friends Showdown
      </Link>
    </header>
  );
}
