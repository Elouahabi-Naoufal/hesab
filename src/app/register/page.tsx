import { registerAction } from "@/server/auth/actions";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900 font-bold">H</div>
          <h1 className="text-2xl font-bold">Create account</h1>
          <p className="text-sm text-zinc-500">Join Hesab — your public ID will be used for invites</p>
        </div>

        <form action={async (formData: FormData) => { "use server"; await registerAction(formData); }} className="space-y-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div>
            <label className="text-sm font-medium">Display Name</label>
            <input name="displayName" required placeholder="Naoufal" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white" />
          </div>
          <div>
            <label className="text-sm font-medium">Username</label>
            <input name="username" required placeholder="naoufal" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white" />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input name="email" type="email" required placeholder="naoufal@example.com" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white" />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input name="password" type="password" required className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white" />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:opacity-90">Create account</button>
          <p className="text-center text-sm text-zinc-500">Already have account? <Link href="/login" className="font-medium text-zinc-900 dark:text-white hover:underline">Login</Link></p>
        </form>
      </div>
    </div>
  );
}
