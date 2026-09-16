import { AppShell } from "@/components/hrms/app-shell";
import { WorkspaceProvider } from "@/components/hrms/workspace-provider";

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
