import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import NotPlatformOperator from "@/components/Platform/NotPlatformOperator";
import PlatformConsole from "@/components/Platform/PlatformConsole";
import { auth } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db";
import { isPlatformAdminEmail } from "@/server/platform-admin/access";

export const metadata = { title: "Platform console | Nucleus", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Platform operator console: organisations, their modules/sub-modules/features, and their users. */
export default async function PlatformPage() {
  if (!databaseConfigured) notFound();
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) redirect("/login?callbackUrl=/platform");
  if (!isPlatformAdminEmail(session.user.email)) return <NotPlatformOperator email={session.user.email} />;
  return <PlatformConsole adminName={session.user.name} />;
}
