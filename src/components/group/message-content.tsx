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
    <p className="leading-relaxed wrap-break-word whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (part.startsWith("@") && part.length > 1) {
          const mentionedName = part.slice(1).toLowerCase();
          const isMentioningMe = mentionedName === currentUsername.toLowerCase();

          if (isMentioningMe) {
            return (
              <span
                key={index}
                className={`font-bold transition-colors ${
                  isMe ? "text-amber-700" : "text-amber-900 dark:text-amber-200"
                }`}
              >
                {part}
              </span>
            );
          }

          return (
            <span
              key={index}
              className={`font-semibold ${isMe ? "text-primary-foreground" : "text-primary"}`}
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
