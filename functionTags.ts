/**
 * JORFSearch function tags, with the French label shown to users.
 *
 * Mirrors the vocabulary maintained in the joel bot repository. Tags absent
 * from this table are still valid JORFSearch queries; they fall back to the
 * raw tag.
 */
export const FUNCTION_TAG_LABELS: Record<string, string> = {
  ambassadeur: "Ambassadeur",
  avocat_aux_conseils: "Avocat aux conseils",
  cabinet_ministeriel: "Cabinet ministériel",
  centre_detention: "Centre de détention",
  commissaire_de_justice: "Commissaire de justice",
  commissaire_de_justice_creation_office:
    "Commissaire de justice - Création d'office",
  commissaire_gouvernement: "Commissaire du gouvernement",
  commission_parlementaire: "Commission parlementaire",
  conseil_des_ministres: "Conseil des ministres",
  conseiller_affaire_etrangeres: "Conseiller des affaires étrangères",
  consul: "Consul",
  cour_administrative_appel: "Cour administrative d'appel",
  cour_appel: "Cour d'appel",
  cour_cassation: "Cour de cassation",
  cour_comptes: "Cour des comptes",
  legion_honneur: "Décoration : Légion d'honneur",
  medaille_securite_interieure:
    "Décoration : Médaille de la sécurité intérieure",
  medaille_militaire: "Décoration : Médaille militaire",
  ordre_nation: "Décoration : Ordre de la nation",
  ordre_merite: "Décoration : Ordre du mérite",
  delegation_parlementaire: "Délégation parlementaire",
  directeur_academie: "Directeur d'académie",
  direction_hopital: "Direction d'hôpital",
  eleve_ena: "Élève INSP/ENA",
  eleve_ens: "Élève ENS",
  eleve_ira: "Élève IRA",
  eleve_mines: "Élève des Mines",
  eleve_polytechnique: "Élève de Polytechnique",
  eleve_ponts_et_chaussees: "Élève des Ponts et chaussées",
  greffier: "Greffier",
  haut_fonctionnaire_defense: "Haut fonctionnaire de défense et de sécurité",
  huissier: "Huissier",
  huissier_creation_office: "Huissier - Création d'office",
  magistrat: "Magistrat",
  maitre_de_conference: "Maître de conférences",
  membre_gouvernement: "Membre du gouvernement",
  ministre: "Ministre",
  notaire: "Notaire",
  notaire_creation_office: "Notaire - Création d'office",
  notaire_suppression_office: "Notaire - Suppression d'office",
  notaire_tranfert_office: "Notaire - Transfert d'office",
  prefet: "Préfet",
  president: "Président",
  professeur: "Professeur",
  recteur_academie: "Recteur d'académie",
  secretaire_affaires_etrangeres: "Secrétaire des affaires étrangères",
  secretaire_etat: "Secrétaire d'État",
  secretaire_general_de_prefecture: "Secrétaire général de préfecture",
  "sous-prefet": "Sous-préfet",
  tribunal: "Tribunal",
  tribunal_administratif: "Tribunal administratif",
  tribunal_commerce: "Tribunal de commerce",
  tribunal_grande_instance: "Tribunal de grande instance",
  tribunal_instance: "Tribunal d'instance",
  tribunal_judiciaire: "Tribunal judiciaire",
  tribunal_pour_enfants: "Tribunal pour enfants",
  tribunal_premiere_instance: "Tribunal de première instance",
  tribunal_proximite: "Tribunal de proximité",
  visa_grands_etablissements: "Visa grands établissements",
};

/** The French label for a function tag, or the tag itself when unknown. */
export function functionTagLabel(tag: string): string {
  return FUNCTION_TAG_LABELS[tag] ?? tag;
}
