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
  const preferences = await Promise.all(
    emails.map(async (email) => {
      const res = await fetch(
        `${
          process.env.NEXT_PUBLIC_APP_URL
        }/api/visibility?email=${encodeURIComponent(email)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      return [email, data.visible] as [string, boolean];
    })
  );

  return Object.fromEntries(preferences);
}

export function shouldShowInfo(
  email: string,
  currentUserEmail?: string,
  visibilityMap?: Record<string, boolean>
): boolean {
  if (!email) return false;
  // if (currentUserEmail === email) return true;
  return visibilityMap?.[email] ?? false;
}
