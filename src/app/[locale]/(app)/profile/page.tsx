import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { updateProfileAction } from "@/server/profile/actions";
import AvatarPicker from "@/components/AvatarPicker";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { avatarSrc } from "@/lib/avatar";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

const MAX_AVATAR_MB = 2;

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");

  const t = await getTranslations({ locale: locale as AppLocale, namespace: "profile" });

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <h1 className="font-extrabold text-[26px] tracking-tight">{t("title")}</h1>
        <div className="card-elevated p-6 space-y-4">
          <div className="grid gap-3 text-[14px]">
            <div className="flex items-center gap-3">
              <span className="text-muted w-20">{t("publicId")}</span>
              <span className="font-mono bg-elevated px-2.5 py-1 rounded-[8px] text-[13px]">{user.publicId}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted w-20">{t("username")}</span>
              <span>{user.username}</span>
            </div>
          </div>
        </div>

        <form action={async (formData: FormData) => { "use server"; await updateProfileAction(formData); }} className="card-elevated p-6 space-y-5">
          <h2 className="text-[15px] font-semibold">{t("editProfile")}</h2>
          <AvatarPicker
            currentAvatar={avatarSrc(user)}
            displayName={user.displayName}
            uploadLabel={t("uploadPic")}
            changeLabel={t("changePic")}
            removeLabel={t("removePic")}
            hint={t("picHint")}
            maxMB={MAX_AVATAR_MB}
          />
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted">{t("displayName")}</label>
            <input name="displayName" defaultValue={user.displayName} required minLength={2} maxLength={50} className="input" />
          </div>
          <button className="btn-primary">{t("save")}</button>
        </form>

        <LanguageSwitcher />

        <div className="card border-dashed p-6 text-center text-[13px] text-muted">
          ID <span className="font-mono text-foreground">{user.publicId}</span> {t("shareHint")}
        </div>
    </main>
  );
}
