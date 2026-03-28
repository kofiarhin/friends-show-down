const rawApiUrl = import.meta.env.VITE_API_URL?.trim() ?? "";

if (!rawApiUrl) {
  console.error(
    "VITE_API_URL is not set. Set it in client/.env.local (dev) or Vercel environment variables (production).",
  );
}

const normalizeBaseUrl = (value) => value.replace(/\/+$/, "");

export const apiBase = rawApiUrl ? normalizeBaseUrl(rawApiUrl) : "";
export const socketUrl = apiBase;
