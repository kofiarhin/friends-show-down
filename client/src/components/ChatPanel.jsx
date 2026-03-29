import { useEffect, useRef, useState } from "react";

export default function ChatPanel({
  enabled,
  messages = [],
  onSend,
  error,
  placeholder = "Type a message...",
}) {
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSubmit(event) {
    event.preventDefault();
    setLocalError(null);

    if (!enabled) {
      setLocalError("Chat is disabled right now.");
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed) {
      setLocalError("Please enter a message.");
      return;
    }

    if (trimmed.length > 250) {
      setLocalError("Message must be 250 characters or fewer.");
      return;
    }

    onSend(trimmed);
    setDraft("");
  }

  return (
    <div className="chat-panel rounded-3xl border border-white/10 bg-slate-900/90 p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-400">
          Chat
        </h2>
        <span className="text-xs text-gray-500">
          {enabled ? "Open" : "Disabled"}
        </span>
      </div>

      <div
        ref={listRef}
        className="mb-3 max-h-64 overflow-y-auto rounded-2xl border border-white/5 bg-gray-950 px-3 py-3 space-y-3"
      >
        {messages.length === 0 ? (
          <p className="text-xs text-gray-500">No messages yet.</p>
        ) : (
          messages.map((message) => (
            <div key={message.messageId} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">
                  {message.nickname}
                </span>
                <span className="text-[11px] text-gray-500">
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-sm text-gray-200">{message.message}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={!enabled}
            placeholder={
              enabled
                ? placeholder
                : "Chat is unavailable during active questions."
            }
            className="w-full rounded-2xl border border-white/10 bg-gray-900 px-4 py-3 text-sm text-white outline-none transition disabled:cursor-not-allowed disabled:bg-gray-800"
          />
        </div>
        <div className="flex flex-col gap-2">
          {(localError || error) && (
            <p className="text-xs text-red-400">{localError || error}</p>
          )}
          <button
            type="submit"
            disabled={!enabled}
            className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
