"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProfileNameAction } from "@/lib/actions/profile";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateProfileNameAction(value);
      toast.success("Nom mis a jour");
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
    </div>
  );
}
