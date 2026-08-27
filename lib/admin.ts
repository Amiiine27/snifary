// Statut admin code en dur plutot qu'une colonne role sur `user` : un seul
// admin sur ce projet perso a "quelques utilisateurs", une vraie gestion de
// roles serait de la complexite pour un gain nul a cette echelle.
const ADMIN_EMAIL = "amineakh2004@gmail.com";

export function isAdminEmail(email: string): boolean {
  return email.toLowerCase() === ADMIN_EMAIL;
}
