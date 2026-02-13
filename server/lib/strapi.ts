// lib/strapi.ts
const STRAPI_URL = process.env.STRAPI_URL!;
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN!;

export async function strapiGet(path: string) {
  const res = await fetch(`${STRAPI_URL}/api${path}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Strapi ${res.status}: ${txt}`);
  }
  return res.json();
}
