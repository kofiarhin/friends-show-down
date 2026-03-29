import { useEffect, useRef, useState } from "react";

export default function ChatPanel({
  enabled,
  messages = [],
  onSend,
  error,
  placeholder = "Type a message...",
  currentUserId,
  title = "Chat",
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
    <div className="chat-panel flex h-full min-h-[28rem] flex-col rounded-3xl border border-white/10 bg-slate-900/90 shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-400">
            {title}
          </p>
          <p className="text-xs text-gray-500">
            {messages.length} message{messages.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="text-xs text-gray-500">
          {enabled ? "Open" : "Disabled"}
        </span>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-4 min-h-0 space-y-3"
      >
        {messages.length === 0 ? (
          <p className="text-xs text-gray-500">No messages yet.</p>
        ) : (
          messages.map((message) => {
            const isMine = currentUserId && message.playerId === currentUserId;
            const timestamp = new Date(message.timestamp).toLocaleTimeString(
              [],
              {
                hour: "2-digit",
                minute: "2-digit",
              },
            );

            return (
              <div
                key={message.messageId}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-3xl px-4 py-3 shadow-sm ${
                    isMine
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-800 text-gray-200"
                  }`}
                >
                  {!isMine && (
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">
                        {message.nickname}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {timestamp}
                      </span>
                    </div>
                  )}
                  <p className="text-sm leading-6">{message.message}</p>
                  {isMine && (
                    <div className="mt-2 text-right text-[10px] text-white/80">
                      {timestamp}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-white/10 px-4 py-4 bg-slate-950"
      >
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
        <div className="mt-3 flex flex-col gap-2">
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
