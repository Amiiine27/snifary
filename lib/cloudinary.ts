import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// On ne stocke jamais l'URL Cloudinary en base, uniquement le public_id
// (portabilite future vers R2 ou un autre host d'images).
export function cloudinaryUrl(publicId: string | null, options?: { width?: number }) {
  if (!publicId) return null;
  return cloudinary.url(publicId, {
    secure: true,
    fetch_format: "auto",
    quality: "auto",
    width: options?.width,
    crop: options?.width ? "limit" : undefined,
  });
}

export async function uploadImageFromUrl(sourceUrl: string, folder: string) {
  const result = await cloudinary.uploader.upload(sourceUrl, { folder });
  return result.public_id;
}

export async function uploadImageFromBuffer(buffer: Buffer, folder: string) {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error || !result) return reject(error);
      resolve(result.public_id);
    });
    stream.end(buffer);
  });
}

// Cas particulier de l'avatar utilisateur (champ `image` de Better Auth) :
// ce champ attend une URL directe (c'est aussi ce que Google y met a la
// creation du compte), pas un public_id. On y fait donc exception a la regle
// "public_id uniquement" du reste de l'app.
export async function uploadAvatarFromBuffer(buffer: Buffer) {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "avatars", transformation: { width: 256, height: 256, crop: "fill" } },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

export async function deleteImage(publicId: string) {
  await cloudinary.uploader.destroy(publicId);
}
