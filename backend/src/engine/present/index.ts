// Presentation layer: turns a successful result set into what the UI renders -
// a deterministically chosen chart, a plain-English explanation, and a one-line
// description of the SQL. Chart selection is pure and always succeeds; the LLM
// is used only where the problem is genuinely fuzzy (the prose).

import type { FieldMeta, LLMProvider, Presentation } from "../types";
import { selectChart } from "./chart";
import { explainResult } from "./explain";

export { selectChart } from "./chart";
export { explainResult } from "./explain";

export interface PresentInput {
  question: string;
  sql: string;
  fields: FieldMeta[];
  rows: Record<string, unknown>[];
}

export async function present(
  input: PresentInput,
  llm: LLMProvider,
  opts: { explain?: boolean } = {}
): Promise<Presentation> {
  const chart = selectChart(input.fields, input.rows);

  // The benchmark (Day 6) runs dozens of questions and needs neither prose nor
  // the LLM call it costs, so explanation is skippable.
  if (opts.explain === false) {
    return { chart, explanation: "", sqlDescription: "" };
  }

  const { explanation, sqlDescription } = await explainResult(
    input.question,
    input.sql,
    input.fields,
    input.rows,
    llm
  );
  return { chart, explanation, sqlDescription };
}
