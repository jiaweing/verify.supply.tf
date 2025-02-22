import { AdminLogoutButton } from "@/components/admin-logout-button";
import Link from "next/link";
import { Toaster } from "sonner";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-background w-screen">
      <header className="sticky top-0 z-50 w-screen border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-7xl md:px-0 px-8 mx-auto flex h-14 items-center">
          <div className="mr-4 flex">
            <a href="/admin" className="mr-6 flex items-center space-x-2">
              <span className="font-semibold hidden md:inline-block">
                SUPPLY: THE FUTURE
              </span>
              <span className="font-semibold md:hidden">supply.tf</span>
            </a>
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <Link
                href="/admin"
                className="transition-colors hover:text-foreground/80 text-foreground"
              >
                Items
              </Link>
              <Link
                href="/admin/series"
                className="transition-colors hover:text-foreground/80 text-foreground"
              >
                Series
              </Link>
            </nav>
          </div>
          <Toaster richColors position="top-center" />
          <div className="flex flex-1 items-center justify-end space-x-4">
            <AdminLogoutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 py-8 px-8">
        <div className="container max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
