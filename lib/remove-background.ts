// Suppression de fond 100% cote navigateur (WASM), pas de service tiers ni
// d'infra a nous : @imgly/background-removal. Modele "quint8" (quantifie,
// le plus leger/rapide des trois) car un flacon sur fond uni est un cas
// de segmentation facile, pas besoin du modele le plus lourd.
export async function removeImageBackground(file: File): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal");
  return removeBackground(file, {
    model: "isnet_quint8",
    output: { format: "image/png" },
  });
}
