"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateProfileNameAction, updateGenderPreferenceAction } from "@/lib/actions/profile";

type Gender = "homme" | "femme" | "unisexe";

export function ProfileForm({
  name,
  email,
  genderPreference,
}: {
  name: string;
  email: string;
  genderPreference: Gender;
}) {
  const [value, setValue] = useState(name);
  const [gender, setGender] = useState<Gender>(genderPreference);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateProfileNameAction(value);
      toast.success("Nom mis a jour");
    });
  }

  function handleGenderChange(next: Gender) {
    setGender(next);
    startTransition(async () => {
      await updateGenderPreferenceAction(next);
      toast.success("Preference enregistree");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <Label>Nom d&apos;utilisateur</Label>
        <div className="flex gap-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} />
          <Button onClick={handleSave} disabled={pending || value.trim() === name}>
            Modifier
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>E-mail</Label>
        <Input value={email} disabled />
      </div>

      <div className="space-y-1.5">
        <Label>Genre pour Decouvrir</Label>
        <Select value={gender} onValueChange={(v) => handleGenderChange(v as Gender)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="homme">Homme</SelectItem>
            <SelectItem value="femme">Femme</SelectItem>
            <SelectItem value="unisexe">Unisexe</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Filtre les suggestions de la section &quot;Decouvrir&quot; sur l&apos;accueil.
        </p>
      </div>
    </div>
  );
}
