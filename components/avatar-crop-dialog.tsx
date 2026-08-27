"use client";

import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cropImageToBlob } from "@/lib/crop-image";

export function AvatarCropDialog({
  imageSrc,
  open,
  onOpenChange,
  onCropped,
}: {
  imageSrc: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCropped: (blob: Blob) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels) return;
    setWorking(true);
    try {
      const blob = await cropImageToBlob(imageSrc, croppedAreaPixels);
      onCropped(blob);
      onOpenChange(false);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Rogner la photo</DialogTitle>
        </DialogHeader>

        {imageSrc && (
          <>
            <div className="relative h-72 w-full overflow-hidden rounded-lg bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
              />
            </div>

            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-foreground"
              aria-label="Zoom"
            />

            <Button onClick={handleConfirm} disabled={working}>
              {working ? "Enregistrement..." : "Valider le recadrage"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
