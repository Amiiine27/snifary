import { requireUser } from "@/lib/session";
import { FeedbackForm } from "@/components/feedback-form";
import { BrandHeader } from "@/components/brand-header";

export default async function FeedbackPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      <div>
        <BrandHeader />
        <p className="mt-1 text-center text-base text-muted-foreground">Ton avis compte !</p>
      </div>

      <p className="text-sm text-muted-foreground">
        Un commentaire, une idee, un axe d&apos;amelioration ? N&apos;hesite pas.
      </p>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Nom d&apos;utilisateur</p>
          <p>{user.name}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">E-mail</p>
          <p className="truncate">{user.email}</p>
        </div>
      </div>

      <FeedbackForm />
    </div>
  );
}
