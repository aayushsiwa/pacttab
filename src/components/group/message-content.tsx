import React from "react";

interface MessageContentProps {
  body: string;
  currentUsername: string;
  isMe: boolean;
}

export function MessageContent({ body, currentUsername, isMe }: MessageContentProps) {
  // Split message by @mentions while preserving delimiters
  const mentionRegex = /(@[a-zA-Z0-9_]+)/g;
  const parts = body.split(mentionRegex);

  return (
    <p className="break-words whitespace-pre-wrap leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith("@") && part.length > 1) {
          const mentionedName = part.slice(1).toLowerCase();
          const isMentioningMe = mentionedName === currentUsername.toLowerCase();

          if (isMentioningMe) {
            return (
              <span
                key={index}
                className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-bold transition-colors ${
                  isMe
                    ? "bg-white/20 text-white underline underline-offset-2"
                    : "bg-amber-500/20 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/40"
                }`}
              >
                {part}
              </span>
            );
          }

          return (
            <span
              key={index}
              className={`inline-flex items-center px-1 py-0.2 rounded-md font-semibold text-xs ${
                isMe
                  ? "bg-white/15 text-white/95"
                  : "bg-primary/15 text-primary dark:text-primary-foreground font-semibold"
              }`}
            >
              {part}
            </span>
          );
        }

        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </p>
  );
}
