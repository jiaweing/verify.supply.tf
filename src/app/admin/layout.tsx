import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-7xl mx-auto flex h-14 items-center">
          <div className="mr-4 flex">
            <a href="/admin" className="mr-6 flex items-center space-x-2">
              <span className="font-semibold inline-block">
                SUPPLY: THE FUTURE
              </span>
            </a>
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <a
                href="/admin"
                className="transition-colors hover:text-foreground/80 text-foreground"
              >
                Items
              </a>
              <a
                href="/admin/transfers"
                className="text-foreground/60 transition-colors hover:text-foreground/80"
              >
                Transfers
              </a>
            </nav>
          </div>
          <div className="flex flex-1 items-center justify-end">
            <form action="/api/auth/admin/logout" method="POST">
              <Button variant="ghost" type="submit" size="sm">
                Logout
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 py-8">
        <div className="container max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
