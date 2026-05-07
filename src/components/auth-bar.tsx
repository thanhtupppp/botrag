"use client";

import Link from "next/link";

type Props = {
  email?: string | null;
};

export function AuthBar({ email }: Props) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
      <span>{email ? `Signed in as ${email}` : "Not signed in"}</span>
      <div className="flex items-center gap-3">
        <Link
          className="text-violet-300 hover:text-violet-200"
          href="/auth/login"
        >
          Login
        </Link>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="text-white/50 hover:text-white/80">
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}
