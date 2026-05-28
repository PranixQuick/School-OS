import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Block auth-gated areas and all API routes from crawlers
      disallow: [
        '/api/',
        '/dashboard',
        '/students',
        '/teacher-eval',
        '/report-cards',
        '/admissions',
        '/automation',
        '/analytics',
        '/billing',
        '/settings',
        '/connectors',
        '/import',
        '/principal',
        '/whatsapp',
        '/admin',
      ],
    },
    sitemap: 'https://www.edprosys.com/sitemap.xml',
  };
}
