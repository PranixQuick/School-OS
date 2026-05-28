import type { MetadataRoute } from 'next';

// Static sitemap — EdProSys is a B2B SaaS with auth-gated content.
// Only public-facing routes are listed here.
// Dynamic per-school pages are not crawlable (they require auth).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.edprosys.com';
  const now = new Date();

  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${base}/register`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${base}/parent`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];
}
