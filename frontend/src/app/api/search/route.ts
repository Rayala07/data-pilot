import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

// Static, build-time search index for the docs (client-side search UI).
export const { GET } = createFromSource(source, {
  language: "english",
});
