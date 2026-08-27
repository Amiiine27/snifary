// Jeu de mot aleatoire parmi une liste predefinie (cf. maquette : "Ca sent
// bon cette histoire"). Reutilise sur les ecrans d'auth/accueil.
export const taglines = [
  "Ca sent bon cette histoire",
  "Je te sens bien celui-la",
  "L'amour est dans le flacon",
  "Une histoire de nez",
  "Ca ne sent pas le sapin",
  "Le nez fin ne ment jamais",
  "Effluves de bonheur",
];

export function randomTagline() {
  return taglines[Math.floor(Math.random() * taglines.length)];
}
