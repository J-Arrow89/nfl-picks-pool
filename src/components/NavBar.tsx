import Link from "next/link";
import SignOutButton from "./SignOutButton";

export default function NavBar({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
      <Link href="/" className="text-white font-bold text-sm tracking-tight">
        🏈 Who Ya Got?
      </Link>
      <nav className="flex items-center gap-4">
        <Link href="/" className="text-xs text-slate-300 hover:text-white transition">
          This Week
        </Link>
        <Link href="/standings" className="text-xs text-slate-300 hover:text-white transition">
          Standings
        </Link>
        <span className="text-xs text-slate-500">{name}</span>
        <SignOutButton />
      </nav>
    </div>
  );
}
