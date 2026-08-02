import { requireSession } from "@/lib/auth";
import { SettingsTabs } from "./SettingsTabs";

export default async function SettingsLayout({
  children,
}: LayoutProps<"/settings">) {
  const session = await requireSession();
  const isAdmin = session.role === "tenant_admin";

  return (
    <div className="px-6 py-10">
      <h1 className="sr-only">Settings</h1>
      <SettingsTabs isAdmin={isAdmin} />
      <div className="mt-8">{children}</div>
    </div>
  );
}
