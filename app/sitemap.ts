import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Only real pages belong here. The /api/* routes are JSON data for the demo,
// not pages, and robots.txt keeps crawlers out of them.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
