import defaultMdxComponents from "fumadocs-ui/mdx";
import { Card, Cards } from "fumadocs-ui/components/card";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Callout } from "fumadocs-ui/components/callout";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { TypeTable } from "fumadocs-ui/components/type-table";
import type { MDXComponents } from "mdx/types";

// Registered globally so every .mdx page can use these without a per-file
// import. Page-level overrides (e.g. relative-link `a`) are merged last.
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Card,
    Cards,
    Step,
    Steps,
    Callout,
    Tab,
    Tabs,
    Accordion,
    Accordions,
    TypeTable,
    ...components,
  };
}
