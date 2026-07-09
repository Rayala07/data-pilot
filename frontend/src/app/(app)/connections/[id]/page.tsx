import { SchemaView } from "@/features/connections/components/SchemaView";

export default async function SchemaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SchemaView connectionId={id} />;
}
