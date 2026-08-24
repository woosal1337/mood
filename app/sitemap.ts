import type { MetadataRoute } from "next";

/**
 * mood is one URL.
 *
 * The plane is a single route: every image opens in place, so there is no
 * second page for a crawler to reach and nothing here to generate from the
 * board data. The file exists anyway because `robots.ts` names a sitemap, and
 * a `Sitemap:` line pointing at a 404 is worse than no line at all.
 *
 * `next.config.mjs` sets `trailingSlash: true`, so the canonical form of the
 * root carries the slash and the URL below matches what the export serves.
 */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://mood.chele.bi/",
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
