// Journal des nouveautes, maintenu a la main a chaque changement notable.
// Version la plus recente en premier.
const CHANGELOG: { version: string; changes: string[] }[] = [
  {
    version: "1.20",
    changes: [
      "Vraies photos de flacon sur Decouvrir, les pages marque et \"Vous pourriez aimer\" (avant : icone generique)",
      "Ajout d'un parfum : image trouvee de facon beaucoup plus fiable qu'avant",
    ],
  },
  {
    version: "1.19",
    changes: [
      "App responsive sur tablette et PC : la coque, les grilles et les menus s'adaptent a l'ecran",
      "Le bouton + et les sheets restent bien alignes avec le contenu, meme sur grand ecran",
    ],
  },
  {
    version: "1.18",
    changes: [
      "Meme affichage pour la collection et les wishlists : seuls le nom, les parfums et les chips changent",
      "Chips \"X parfums\" / \"X€ au total\" sur les wishlists aussi",
      "Bouton pour supprimer une wishlist entiere",
    ],
  },
  {
    version: "1.17",
    changes: ["Avis archivables ou supprimables depuis la page admin"],
  },
  {
    version: "1.16",
    changes: [
      "Le carrousel des wishlists permet aussi de revenir a la collection",
      "Wishlists reordonnables depuis l'accueil (fleches haut/bas)",
      "L'upload de photo ne bloque plus l'edition du reste du formulaire",
      "Possible d'ajouter une autre variante d'un parfum deja present (ex. une nouvelle concentration)",
      "Cloche d'avis pour le compte admin, en haut a gauche",
    ],
  },
  {
    version: "1.15",
    changes: [
      "Nouvelle source d'image (Open Beauty Facts), en plus de Wikipedia -- surtout efficace sur les grandes marques",
      "Description trouvee automatiquement a l'ajout, plus besoin de la remplir soi-meme",
      "\"Vous pourriez aimer\" priorise desormais les notes en commun plutot que la marque",
    ],
  },
  {
    version: "1.14",
    changes: ["Ajoute une photo sur n'importe quel parfum depuis sa fiche (petit bouton camera sur l'image)"],
  },
  {
    version: "1.13",
    changes: ["Correctif : le scroll horizontal de \"Vous pourriez aimer\" ne fonctionnait pas sur mobile"],
  },
  {
    version: "1.12",
    changes: [
      "Section \"Vous pourriez aimer\" sur chaque fiche parfum : suggestions selon la marque, la gamme et les notes en commun",
      "Correctif : la fleche vers les wishlists depuis Collection ne s'affichait pas",
    ],
  },
  {
    version: "1.11",
    changes: [
      "Nouvelle page Decouvrir (remplace l'icone Wishlists) : 30 suggestions, recherche libre, bouton pour tirer une nouvelle selection",
      "Les wishlists restent accessibles depuis Collection, via la fleche vers la premiere wishlist",
    ],
  },
  {
    version: "1.10",
    changes: [
      "Section \"Decouvrir\" sur l'accueil : suggestions de parfums selon le genre choisi dans Profil",
      "Pages marque : tape sur une marque pour parcourir tout son catalogue",
      "Decouvrir et les pages marque ouvrent d'abord la fiche du parfum, avec le choix de la collection et/ou d'une ou plusieurs wishlists",
      "Prix et description modifiables sur n'importe quel parfum, meme deja ajoute",
      "Journal des nouveautes (cette liste !)",
    ],
  },
  {
    version: "1.9",
    changes: [
      "Recherche instantanee dans un catalogue de pres de 24 000 parfums, toutes marques (avant limite a Fragrantica en direct, souvent indisponible)",
      "Ajout direct en un tap, sans ecran de confirmation a remplir",
      "Description et photo recuperees automatiquement sur Wikipedia quand disponibles",
    ],
  },
  {
    version: "1.8",
    changes: [
      "Statistiques affichees en chips au-dessus de la collection",
      "Correctif d'un echec d'upload de photo (\"Impossible de traiter l'image\")",
    ],
  },
  {
    version: "1.7",
    changes: [
      "Ajout limite a la collection depuis la fiche d'un parfum",
      "Suivi des clones/dupes (parfum d'inspiration)",
      "Modification des parfums saisis manuellement",
    ],
  },
  {
    version: "1.6",
    changes: ["Suppression automatique du fond sur les photos ajoutees manuellement"],
  },
  {
    version: "1.5",
    changes: ["Barre du haut toujours visible avec le logo et le theme"],
  },
  {
    version: "1.4",
    changes: ["Header partage, notifications en haut de l'ecran, correctifs de la fiche detail sur mobile"],
  },
  {
    version: "1.3",
    changes: ["Recadrage reel de la photo de profil, page statistiques simplifiee"],
  },
  {
    version: "1.2",
    changes: ["Ajout manuel d'un parfum, corrections de la fiche detail, cartes sur l'accueil"],
  },
  {
    version: "1.1",
    changes: [
      "Interface agrandie, nouvelle police pour les titres, filtres, page statistiques et collection",
      "Corrections recherche, navigation et detection du genre",
    ],
  },
  {
    version: "1.0",
    changes: ["Premiere version : connexion Google, recherche Fragrantica, collection et wishlists"],
  },
];

export function Changelog() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nouveautes</p>
      <div className="flex flex-col gap-5">
        {CHANGELOG.map((entry) => (
          <div key={entry.version}>
            <p className="text-sm font-medium">Version {entry.version}</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {entry.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
