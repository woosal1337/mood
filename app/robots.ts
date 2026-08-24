import type { MetadataRoute } from "next";

/**
 * `/data/` and `/media/` are the plane's own fetches, not pages.
 *
 * They are public and stay public — the tiles cannot load otherwise. Excluding
 * them keeps 8,000 images and one large JSON file out of the crawl budget for
 * a site whose only page is the root.
 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/data/", "/media/"],
    },
    sitemap: "https://mood.chele.bi/sitemap.xml",
    host: "https://mood.chele.bi",
  };
}
