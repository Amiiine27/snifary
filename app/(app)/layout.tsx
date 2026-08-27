import { AppTopBar } from "@/components/app-top-bar";
import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col sm:max-w-2xl lg:max-w-4xl">
      <AppTopBar />
      <main className="flex-1 pb-20 pt-24">{children}</main>
      <BottomNav />
    </div>
  );
}
