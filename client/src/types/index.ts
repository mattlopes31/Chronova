// Types pour Chronova

export type UserRole = 'Admin' | 'Manager' | 'Salarie';
export type ValidationStatus = 'Brouillon' | 'Soumis' | 'Valide' | 'Rejete';
export type CongeType = 'CP' | 'RTT' | 'Maladie' | 'Deplacement' | 'Formation' | 'Sans_solde' | 'Autre';

export interface Salarie {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  tel?: string;
  matricule?: string;
  role: UserRole;
  actif: boolean;
  date_entree?: string;
  derniere_connexion?: string;
  salarie_fonction_id?: string;
  salarie_status_id?: string;
  manager_id?: string;
  taux_horaire?: number;
  fonction?: SalarieFonction;
  status?: SalarieStatus;
  manager?: Pick<Salarie, 'id' | 'nom' | 'prenom' | 'email'>;
}

export interface SalarieFonction {
  id: string;
  code: string;
  libelle: string;
  taux_horaire_defaut?: number;
}

export interface SalarieStatus {
  id: string;
  code: string;
  libelle: string;
}

export interface Client {
  id: string;
  nom: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  pays_id?: string;
  telephone?: string;
  email?: string;
  contact_nom?: string;
  siret?: string;
  actif: boolean;
}

export interface Projet {
  id: string;
  code_projet: string;
  nom: string;
  description?: string;
  client_id?: string;
  projet_status_id?: string;
  start_date?: string;
  end_date?: string;
  date_fin_reelle?: string;
  budget_heures?: number;
  budget_euros?: number;
  actif: boolean;
  archive: boolean;
  client?: Client;
  status?: ProjetStatus;
  taches?: TacheProjet[];
}

export interface ProjetStatus {
  id: string;
  code: string;
  libelle: string;
  couleur?: string;
}

export interface TacheType {
  id: string;
  code: string;
  tache_type: string;
  description?: string;
  couleur?: string;
  is_facturable: boolean;
  facturable?: boolean; // Alias pour compatibilité
  actif: boolean;
}

export interface TacheProjet {
  id: string;
  projet_id: string;
  tache_type_id: string;
  budget_heures?: number;
  taux_horaire?: number;
  actif: boolean;
  projet?: Projet;
  tache_type?: TacheType;
}

export interface TacheProjetSalarie {
  id: string;
  tache_projet_id: string;
  salarie_id: string;
  date_affectation: string;
  actif: boolean;
  tache_projet?: TacheProjet;
  salarie?: Salarie;
}

export interface SalariePointage {
  id: string;
  salarie_id: string;
  projet_id: string;
  tache_projet_id?: string;
  annee: number;
  semaine: number;
  date_lundi: string;
  heure_lundi?: number;
  heure_mardi?: number;
  heure_mercredi?: number;
  heure_jeudi?: number;
  heure_vendredi?: number;
  heure_samedi?: number;
  heure_dimanche?: number;
  total_heures?: number;
  commentaire?: string;
  validation_status: ValidationStatus;
  projet?: Projet;
  tache_projet?: TacheProjet;
}

export interface SalarieCp {
  id: string;
  salarie_id: string;
  annee: number;
  semaine: number;
  date_lundi: string;
  cp_lundi: boolean;
  cp_mardi: boolean;
  cp_mercredi: boolean;
  cp_jeudi: boolean;
  cp_vendredi: boolean;
  type_conge: CongeType;
  // Types par jour (nouveau)
  type_lundi?: CongeType;
  type_mardi?: CongeType;
  type_mercredi?: CongeType;
  type_jeudi?: CongeType;
  type_vendredi?: CongeType;
  commentaire?: string;
  validation_status: ValidationStatus;
}

export interface ValidationSemaine {
  id: string;
  salarie_id: string;
  annee: number;
  semaine: number;
  status: ValidationStatus;
  total_heures_travaillees?: number;
  total_heures_cp?: number;
  date_soumission?: string;
  date_validation?: string;
  validateur_id?: string;
  commentaire_rejet?: string;
}

export interface JourFerie {
  id: string;
  date: string;
  libelle: string;
  annee: number;
}

// Types pour l'interface de pointage
export interface PointageLigne {
  projet: Projet;
  tache?: TacheProjet;
  heures: {
    lundi: number;
    mardi: number;
    mercredi: number;
    jeudi: number;
    vendredi: number;
    samedi: number;
    dimanche: number;
  };
  pointage_id?: string;
}

export interface CongesLigne {
  lundi: boolean;
  mardi: boolean;
  mercredi: boolean;
  jeudi: boolean;
  vendredi: boolean;
  type_conge: CongeType;
}

export interface SemaineSummary {
  heures_travaillees: number;
  heures_cp: number;
  heures_normales: number; // max 35h
  heures_sup: number; // > 35h
  heures_dues: number; // si < 35h (retard cumulable)
  total_semaine: number;
  status: ValidationStatus;
}

export interface HeuresDues {
  salarie_id: string;
  total_heures_dues: number;
  detail_par_semaine: Array<{
    annee: number;
    semaine: number;
    heures_dues: number;
  }>;
}

// Form inputs
export interface LoginInput {
  email: string;
  password: string;
}

export interface PointageInput {
  projet_id: string;
  tache_projet_id?: string;
  annee: number;
  semaine: number;
  heures: {
    lundi: number;
    mardi: number;
    mercredi: number;
    jeudi: number;
    vendredi: number;
    samedi: number;
    dimanche: number;
  };
  commentaire?: string;
}

export interface CongeInput {
  annee: number;
  semaine: number;
  cp_lundi?: boolean;
  cp_mardi?: boolean;
  cp_mercredi?: boolean;
  cp_jeudi?: boolean;
  cp_vendredi?: boolean;
  type_lundi?: CongeType;
  type_mardi?: CongeType;
  type_mercredi?: CongeType;
  type_jeudi?: CongeType;
  type_vendredi?: CongeType;
  type_conge?: CongeType;
  motif?: string;
}