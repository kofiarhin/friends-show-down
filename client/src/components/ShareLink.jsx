import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

const QR_SIZE = 224;

export default function ShareLink({ gameId, gameUrl }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  function handleCopy() {
    if (!gameUrl) return;

    navigator.clipboard
      .writeText(gameUrl)
      .then(() => {
        setCopyError("");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        setCopied(false);
        setCopyError("Could not copy link. Please copy it manually.");
      });
  }

  return (
    <div className="w-full rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
        Invite players
      </p>

      <div className="mt-3">
        <p className="text-sm text-gray-400">Room code</p>
        <p className="text-2xl font-bold tracking-wider text-white">{gameId}</p>
      </div>

      <div className="mt-4 flex w-full items-center gap-2">
        <input
          readOnly
          value={gameUrl || ""}
          aria-label="Invite URL"
          placeholder="Invite link unavailable"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCopy}
          disabled={!gameUrl}
          className="rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {copyError && (
        <p role="alert" className="mt-2 text-sm text-amber-300">
          {copyError}
        </p>
      )}

      {gameUrl && (
        <div className="mt-5 flex flex-col items-center gap-2">
          <div className="rounded-lg bg-white p-4 shadow-sm shadow-black/30">
            <QRCodeSVG
              value={gameUrl}
              size={QR_SIZE}
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="Q"
              includeMargin
              data-testid="invite-qr"
            />
          </div>
          <p className="text-sm text-gray-400">
            Scan with your phone camera to join instantly
          </p>
        </div>
      )}
    </div>
  );
}
