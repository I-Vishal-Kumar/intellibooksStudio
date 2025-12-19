import { DateTime } from "luxon";
import { Message } from "./types";

export function formatTimestamp(date: Date | string): string {
  const dateTime = typeof date === "string" ? DateTime.fromISO(date) : DateTime.fromJSDate(date);
  const now = DateTime.now();

  const diff = now.diff(dateTime, ["days", "hours", "minutes", "seconds"]);

  if (diff.seconds < 60) {
    return "Just now";
  } else if (diff.minutes < 60) {
    return `${Math.floor(diff.minutes)}m ago`;
  } else if (diff.hours < 24) {
    return `${Math.floor(diff.hours)}h ago`;
  } else if (diff.days < 7) {
    return `${Math.floor(diff.days)}d ago`;
  } else if (diff.days < 30) {
    const weeks = Math.floor(diff.days / 7);
    return `${weeks}w ago`;
  } else if (diff.days < 365) {
    const months = Math.floor(diff.days / 30);
    return `${months}mo ago`;
  } else {
    return dateTime.toLocaleString(DateTime.DATE_MED);
  }
}

export function formatFullTimestamp(date: Date | string): string {
  const dateTime = typeof date === "string" ? DateTime.fromISO(date) : DateTime.fromJSDate(date);
  return dateTime.toLocaleString(DateTime.DATETIME_MED);
}

export function generateChatTitle(messages: Message[]): string {
  if (messages.length === 0) {
    return "New Chat";
  }

  const firstUserMessage = messages.find((m) => m.role === "user");
  if (firstUserMessage) {
    const content = firstUserMessage.content.trim();
    if (content.length > 50) {
      return content.substring(0, 50) + "...";
    }
    return content;
  }

  return "New Chat";
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for older browsers
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
  return Promise.resolve();
}

