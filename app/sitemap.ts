import type { MetadataRoute } from "next";

const PAGES = ["", "/players", "/games", "/tools", "/startsit", "/trades", "/waivers", "/lineup"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({ url: `https://www.benchboss.pro${path}`, changeFrequency: "daily", priority: path ? 0.7 : 1 }));
}
