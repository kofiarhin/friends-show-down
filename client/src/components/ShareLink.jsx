import { useState } from "react";

export default function ShareLink({ gameId }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/game/${gameId}/join`;

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <input
        readOnly
        value={url}
        className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 focus:outline-none"
      />
      <button
        onClick={handleCopy}
        className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium transition"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
