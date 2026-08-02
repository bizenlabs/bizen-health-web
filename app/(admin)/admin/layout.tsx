import Link from "next/link";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireRole("super_admin");
  return (
    <div className="min-h-dvh">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="flex items-center gap-6 px-6 py-3 text-sm">
          <span className="font-semibold">Admin</span>
          <Link
            href="/admin"
            className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
          >
            Tenants
          </Link>
          <Link
            href="/admin/usage"
            className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
          >
            Usage &amp; cost
          </Link>
          <Link
            href="/admin/templates"
            className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
          >
            Templates
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
