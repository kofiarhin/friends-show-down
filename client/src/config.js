const raw = import.meta.env.VITE_API_URL;

if (!raw) {
  console.error(
    "VITE_API_URL is not set. Set it in client/.env.local (dev) or Vercel environment variables (production)."
  );
}

const apiBase = raw ? raw.replace(/\/$/, "") : "";

export const socketUrl = apiBase;
export { apiBase };
