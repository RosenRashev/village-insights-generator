import { createFileRoute } from "@tanstack/react-router";

const SITE = "https://kadeda.eu";

const STATIC_PAGES: { path: string; changefreq: string; priority: string }[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/politika-za-poveritelnost", changefreq: "yearly", priority: "0.3" },
  { path: "/obshti-usloviya", changefreq: "yearly", priority: "0.3" },
  { path: "/politika-za-biskvitki", changefreq: "yearly", priority: "0.3" },
  { path: "/kontakti", changefreq: "monthly", priority: "0.5" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = STATIC_PAGES.map(
          (p) =>
            `  <url>\n    <loc>${SITE}${p.path}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`,
        );

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;

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
