import { EngineOffline } from "@/components/EngineOffline";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hex-shell">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <EngineOffline />
          <main className="flex-1 px-6 pb-16 pt-6 sm:px-8 lg:px-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
