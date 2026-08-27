"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { authClient, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function AccountActions() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
      router.push("/login");
    });
  }

  function handleDeleteAccount() {
    if (!window.confirm("Supprimer definitivement ton compte et toutes tes donnees ?")) return;
    startTransition(async () => {
      await authClient.deleteUser();
      router.push("/login");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="destructive" onClick={handleSignOut} disabled={pending}>
        Deconnexion
      </Button>
      <Button variant="outline" onClick={handleDeleteAccount} disabled={pending}>
        <Trash2 /> Supprimer mon compte
      </Button>
    </div>
  );
}
