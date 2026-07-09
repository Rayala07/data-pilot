import { QueryView } from "@/features/query/components/QueryView";

export default async function QueryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QueryView connectionId={id} />;
}
