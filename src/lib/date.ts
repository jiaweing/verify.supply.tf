export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  })}`;
}
