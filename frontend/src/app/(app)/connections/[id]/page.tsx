import { ConnectionOverview } from "@/features/connections/components/ConnectionOverview";

export default async function ConnectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConnectionOverview connectionId={id} />;
}
