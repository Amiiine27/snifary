import { requireUser } from "@/lib/session";
import { AvatarUploader } from "@/components/avatar-uploader";
import { ProfileForm } from "@/components/profile-form";
import { AccountActions } from "@/components/account-actions";
import { BrandHeader } from "@/components/brand-header";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-8 px-4 pt-6">
      <BrandHeader />

      <AvatarUploader name={user.name} image={user.image ?? null} />

      <ProfileForm name={user.name} email={user.email} />

      <div className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
        <p>Connecte avec Google</p>
      </div>

      <AccountActions />
    </div>
  );
}
