import { getVisibilityPreferencesAction } from "@/app/items/[id]/preferences/actions";

export function maskInfo(text: string): string {
  if (!text) return text;
  if (text.includes("@")) {
    // Email masking
    const [localPart, domain] = text.split("@");
    const [domainName, tld] = domain.split(".");
    return `${localPart[0]}****${localPart[localPart.length - 1]}@${
      domainName[0]
    }****${domainName[domainName.length - 1]}.${tld}`;
  }
  // Name masking
  return `${text[0]}****${text[text.length - 1]}`;
}

export async function fetchVisibilityPreferences(emails: string[]) {
  return getVisibilityPreferencesAction(emails);
}

export function shouldShowInfo(
  email: string,
  currentUserEmail?: string,
  visibilityMap?: Record<string, boolean>
): boolean {
  if (!email) return false;
  // If this is the current user's email, respect their visibility preference
  if (email === currentUserEmail) {
    return visibilityMap?.[email] ?? false;
  }
  // For other users, show info if they've chosen to make their info visible
  return visibilityMap?.[email] ?? false;
}
