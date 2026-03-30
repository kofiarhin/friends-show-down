import { useState } from "react";
import ChatPanel from "./ChatPanel";

export default function ChatDrawer({
  enabled,
  title,
  currentUserId,
  messages = [],
  error,
  onSend,
  placeholder,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const messageCount = messages.length;
  const isDisabled = !enabled;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 inline-flex items-center gap-3 rounded-full bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-2xl shadow-indigo-600/30 transition hover:bg-indigo-500 ${
          isOpen ? "hidden" : ""
        }`}
        aria-expanded={isOpen}
      >
        <span>Chat</span>
        {messageCount > 0 && (
          <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-white px-2 text-xs font-semibold text-slate-950">
            {messageCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[28rem] flex-col bg-slate-950 shadow-2xl">
            <div className="relative flex min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute right-4 top-4 z-10 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/15"
              >
                Close
              </button>

              <div className="flex-1 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-inner">
                <ChatPanel
                  enabled={!isDisabled}
                  title={title}
                  currentUserId={currentUserId}
                  messages={messages}
                  error={error}
                  onSend={onSend}
                  placeholder={placeholder}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close chat drawer"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-30 bg-black/40"
          />
        </>
      )}
    </>
  );
}
