"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Crop, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { uploadAvatarAction, deleteAvatarAction } from "@/lib/actions/profile";

export function AvatarUploader({ name, image }: { name: string; image: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(image);

  function handleFile(file: File | undefined) {
    if (!file) return;
    startTransition(async () => {
      await uploadAvatarAction(file);
      setPreview(URL.createObjectURL(file));
      toast.success("Avatar mis a jour");
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteAvatarAction();
      setPreview(null);
      toast.success("Avatar supprime");
    });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Avatar className="size-24">
        <AvatarImage src={preview ?? undefined} alt={name} />
        <AvatarFallback className="text-2xl">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={pending}>
          <Crop /> Modifier
        </Button>
        {preview && (
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={pending}>
            <Trash2 /> Supprimer
          </Button>
        )}
      </div>
    </div>
  );
}
