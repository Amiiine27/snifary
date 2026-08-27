"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Crop, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { uploadAvatarAction, deleteAvatarAction } from "@/lib/actions/profile";
import { AvatarCropDialog } from "@/components/avatar-crop-dialog";

export function AvatarUploader({ name, image }: { name: string; image: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(image);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  function handleNewFile(file: File | undefined) {
    if (!file) return;
    setCropSource(URL.createObjectURL(file));
    setCropOpen(true);
  }

  function handleReCrop() {
    if (!preview) return;
    setCropSource(preview);
    setCropOpen(true);
  }

  function handleCropped(blob: Blob) {
    const file = new File([blob], "avatar.png", { type: blob.type });
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
        onChange={(e) => handleNewFile(e.target.files?.[0])}
      />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={pending}>
          <Pencil /> Modifier
        </Button>
        {preview && (
          <>
            <Button variant="outline" size="sm" onClick={handleReCrop} disabled={pending}>
              <Crop /> Rogner
            </Button>
            <Button variant="outline" size="sm" onClick={handleDelete} disabled={pending}>
              <Trash2 /> Supprimer
            </Button>
          </>
        )}
      </div>

      <AvatarCropDialog
        imageSrc={cropSource}
        open={cropOpen}
        onOpenChange={setCropOpen}
        onCropped={handleCropped}
      />
    </div>
  );
}
