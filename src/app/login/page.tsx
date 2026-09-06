import { loginAction } from "@/server/auth/actions";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-[14px] bg-brand flex items-center justify-center text-white font-bold text-lg">H</div>
          <h1 className="text-[26px] font-bold tracking-tight">Welcome back</h1>
          <p className="text-[14px] text-muted">Login to your PoolSplit account</p>
        </div>

        <form action={async (formData: FormData) => { "use server"; await loginAction(formData); }} className="card-elevated p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted">Email or Username</label>
            <input name="emailOrUsername" required className="input" placeholder="naoufal@example.com" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted">Password</label>
            <input name="password" type="password" required className="input" />
          </div>
          <button type="submit" className="btn-primary w-full py-2.5">Login</button>
          <p className="text-center text-[13px] text-muted">No account? <Link href="/register" className="font-medium text-brand hover:underline">Register</Link></p>
        </form>
      </div>
    </div>
  );
}
