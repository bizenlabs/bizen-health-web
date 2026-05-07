import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { listMemberships, workos } from "@/lib/workos";
import { OnboardingForm } from "./OnboardingForm";

export default async function Onboarding() {
  const session = await requireSession();

  // Skip the wizard if the user already has an organization (e.g., they
  // accepted an Invitation, or a prior submit already created one).
  const memberships = await listMemberships(session.userId);
  if (memberships.length > 0) {
    redirect("/dashboard");
  }

  // Pull the user record so we can pre-fill a sensible default name for the
  // "individual practitioner" case.
  const user = await workos.userManagement.getUser(session.userId);
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const individualDefault = fullName ? `Dr. ${fullName}` : "";

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">Set up your workspace</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Tell us a bit about how you&apos;ll use Bizen. You can invite team
          members later.
        </p>
        <OnboardingForm individualDefault={individualDefault} />
      </div>
    </main>
  );
}
