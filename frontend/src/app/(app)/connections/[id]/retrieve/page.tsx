import { RetrievalView } from "@/features/retrieval/components/RetrievalView";

export default async function RetrievePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RetrievalView connectionId={id} />;
}
