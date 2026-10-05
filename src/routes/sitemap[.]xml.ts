import { createFileRoute } from "@tanstack/react-router";

import { listPublicPlaces } from "@/lib/public-reports.functions";

const SITE = "https://kadeda.eu";

const STATIC_PAGES: { path: string; changefreq: string; priority: string }[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/sravnenie", changefreq: "monthly", priority: "0.5" },
  { path: "/politika-za-poveritelnost", changefreq: "yearly", priority: "0.3" },
  { path: "/obshti-usloviya", changefreq: "yearly", priority: "0.3" },
  { path: "/politika-za-biskvitki", changefreq: "yearly", priority: "0.3" },
  { path: "/kontakti", changefreq: "monthly", priority: "0.5" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        let places: Awaited<ReturnType<typeof listPublicPlaces>> = [];
        try {
          places = await listPublicPlaces();
        } catch (error) {
          // Без връзка с базата върнатият sitemap съдържа поне статичните страници.
          console.error(error);
        }

        const staticUrls = STATIC_PAGES.map(
          (p) =>
            `  <url>\n    <loc>${SITE}${p.path}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`,
        );
        const placeUrls = places.map(
          (p) =>
            `  <url>\n    <loc>${SITE}/selo/${p.ekatte}</loc>\n    <lastmod>${p.updatedAt.slice(0, 10)}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
        );

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticUrls, ...placeUrls].join("\n")}\n</urlset>\n`;

        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
