import { registerAction } from "@/server/auth/actions";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-[14px] bg-brand flex items-center justify-center text-white font-bold text-lg">H</div>
          <h1 className="text-[26px] font-bold tracking-tight">Create account</h1>
          <p className="text-[14px] text-muted">Join PoolSplit — your public ID will be used for invites</p>
        </div>

        <form action={async (formData: FormData) => { "use server"; await registerAction(formData); }} className="card-elevated p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted">Display Name</label>
            <input name="displayName" required placeholder="Naoufal" className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted">Username</label>
            <input name="username" required placeholder="naoufal" className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted">Email</label>
            <input name="email" type="email" required placeholder="naoufal@example.com" className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted">Password</label>
            <input name="password" type="password" required className="input" />
          </div>
          <button type="submit" className="btn-primary w-full py-2.5">Create account</button>
          <p className="text-center text-[13px] text-muted">Already have account? <Link href="/login" className="font-medium text-brand hover:underline">Login</Link></p>
        </form>
      </div>
    </div>
  );
}
