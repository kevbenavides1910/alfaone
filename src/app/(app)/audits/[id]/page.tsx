import { AuditDetailClient } from "@/components/sig/AuditDetailClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AuditDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <AuditDetailClient auditId={id} />;
}
