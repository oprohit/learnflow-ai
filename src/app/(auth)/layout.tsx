import type { ReactNode } from "react";
import AuthShell from "@/components/AuthShell";
export default function Layout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
