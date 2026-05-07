import { requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireRole("super_admin");
  return <>{children}</>;
}
