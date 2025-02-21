import { Github } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <div className="text-xs text-muted-foreground flex flex-col items-center justify-center space-y-2 pt-4">
      <p>&copy; supply.tf {new Date().getFullYear()}.</p>
      <p className="flex flex-row gap-1">
        Fully verifiable and{" "}
        <Link
          href="https://github.com/jiaweing/verify.supply.tf"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary flex flex-row gap-1"
        >
          <Github className="h-4 w-4" /> <span>open-source</span>
        </Link>
      </p>
    </div>
  );
}
