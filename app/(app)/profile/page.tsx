import { requireUser } from "@/lib/session";
import { AvatarUploader } from "@/components/avatar-uploader";
import { ProfileForm } from "@/components/profile-form";
import { AccountActions } from "@/components/account-actions";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-8 px-4 pt-8">
      <h1 className="text-center text-2xl font-semibold">Snifary</h1>

      <AvatarUploader name={user.name} image={user.image ?? null} />

      <ProfileForm name={user.name} email={user.email} />

      <div className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
        <p>Connecte avec Google</p>
      </div>

      <AccountActions />
    </div>
  );
}
