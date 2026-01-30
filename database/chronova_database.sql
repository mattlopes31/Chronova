-- =====================================================
-- CHRONOVA - Script de création de base de données
-- PostgreSQL 15+
-- =====================================================
-- Connexion: 127.0.0.1:5432
-- Utilisateur: postgres
-- Mot de passe: root
-- Base de données: Chronova_db
-- =====================================================

-- Créer la base de données (à exécuter en tant que superuser)
-- CREATE DATABASE "Chronova_db" WITH ENCODING 'UTF8';

-- Se connecter à la base
-- \c Chronova_db

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TYPES ENUM
-- =====================================================

-- Statut des projets
CREATE TYPE projet_status_enum AS ENUM ('En_cours', 'Stoppe', 'Termine', 'Annule');

-- Fonction des salariés
CREATE TYPE salarie_fonction_enum AS ENUM ('Cableur', 'DAO', 'Prog', 'Chef_Projet', 'Admin', 'Autre');

-- Statut des salariés
CREATE TYPE salarie_status_enum AS ENUM ('Salarie', 'Interim', 'Sous_traitant', 'Apprentissage', 'Stage', 'Autre');

-- Type de congés (amélioration)
CREATE TYPE conge_type_enum AS ENUM ('CP', 'RTT', 'Maladie', 'Sans_solde', 'Formation', 'Autre');
ALTER TYPE conge_type_enum ADD VALUE 'Deplacement';

-- Statut de validation (amélioration)
CREATE TYPE validation_status_enum AS ENUM ('Brouillon', 'Soumis', 'Valide', 'Rejete');

-- Rôle utilisateur (amélioration pour auth)
CREATE TYPE user_role_enum AS ENUM ('Admin', 'Manager', 'Salarie');

-- =====================================================
-- TABLE: pays
-- =====================================================
CREATE TABLE pays (
    id BIGSERIAL PRIMARY KEY,
    country_name VARCHAR(50) NOT NULL,
    country_code CHAR(10),
    country_code2 CHAR(2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pays_code ON pays(country_code);
CREATE INDEX idx_pays_code2 ON pays(country_code2);

-- =====================================================
-- TABLE: client
-- =====================================================
CREATE TABLE client (
    id BIGSERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    contact_nom VARCHAR(100) NOT NULL,
    contact_prenom VARCHAR(100),
    contact_email VARCHAR(100),
    contact_tel VARCHAR(20),
    adresse VARCHAR(200),
    cp VARCHAR(10),
    ville VARCHAR(100),
    pays_id BIGINT REFERENCES pays(id) ON DELETE SET NULL,
    -- Améliorations
    siret VARCHAR(14),
    code_client VARCHAR(20) UNIQUE,
    actif BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_client_pays ON client(pays_id);
CREATE INDEX idx_client_nom ON client(nom);
CREATE INDEX idx_client_code ON client(code_client);

-- =====================================================
-- TABLE: projet_status (table de référence)
-- =====================================================
CREATE TABLE projet_status (
    id BIGSERIAL PRIMARY KEY,
    status projet_status_enum NOT NULL DEFAULT 'En_cours',
    description VARCHAR(250),
    couleur VARCHAR(7) DEFAULT '#3B82F6', -- Code couleur hex pour l'UI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE: projet
-- =====================================================
CREATE TABLE projet (
    id BIGSERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    code_projet VARCHAR(20) UNIQUE, -- Amélioration: code unique
    projet_status_id BIGINT REFERENCES projet_status(id) ON DELETE SET NULL,
    description VARCHAR(500),
    client_id BIGINT REFERENCES client(id) ON DELETE SET NULL,
    start_date DATE,
    end_date DATE,
    -- Améliorations
    budget_heures DECIMAL(10,2), -- Budget heures estimé
    budget_euros DECIMAL(12,2), -- Budget financier
    priorite INTEGER DEFAULT 1 CHECK (priorite BETWEEN 1 AND 5),
    responsable_id BIGINT, -- FK vers salarie, ajoutée après création de la table salarie
    actif BOOLEAN DEFAULT TRUE,
    archive BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projet_status ON projet(projet_status_id);
CREATE INDEX idx_projet_client ON projet(client_id);
CREATE INDEX idx_projet_dates ON projet(start_date, end_date);
CREATE INDEX idx_projet_code ON projet(code_projet);

-- =====================================================
-- TABLE: salarie_fonction
-- =====================================================
CREATE TABLE salarie_fonction (
    id BIGSERIAL PRIMARY KEY,
    fonction salarie_fonction_enum NOT NULL,
    description VARCHAR(250),
    taux_horaire_defaut DECIMAL(10,2), -- Taux horaire par défaut pour cette fonction
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration: Ajouter la colonne heures_dues à validation_semaine
-- Cette colonne stocke les heures dues (maladie) de chaque semaine pour permettre l'accumulation

-- Ajouter la colonne heures_dues si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'validation_semaine' AND column_name = 'heures_dues'
    ) THEN
        ALTER TABLE validation_semaine 
        ADD COLUMN heures_dues DECIMAL(5, 2) DEFAULT 0;
    END IF;
END $$;

-- Mettre à jour les valeurs existantes à 0 si NULL
UPDATE validation_semaine SET heures_dues = 0 WHERE heures_dues IS NULL;

-- Vérification
SELECT 
    column_name, 
    data_type, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'validation_semaine' 
ORDER BY ordinal_position;

-- =====================================================
-- TABLE: salarie_status
-- =====================================================
CREATE TABLE salarie_status (
    id BIGSERIAL PRIMARY KEY,
    status salarie_status_enum NOT NULL DEFAULT 'Salarie',
    description VARCHAR(250),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE: salarie
-- =====================================================
CREATE TABLE salarie (
    id BIGSERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    tel VARCHAR(20),
    actif BOOLEAN DEFAULT TRUE,
    password_hash VARCHAR(255), -- Hash bcrypt du mot de passe
    salarie_fonction_id BIGINT REFERENCES salarie_fonction(id) ON DELETE SET NULL,
    salarie_status_id BIGINT REFERENCES salarie_status(id) ON DELETE SET NULL,
    -- Améliorations
    matricule VARCHAR(20) UNIQUE,
    date_entree DATE,
    date_sortie DATE,
    taux_horaire DECIMAL(10,2), -- Taux horaire spécifique au salarié
    heures_hebdo DECIMAL(4,1) DEFAULT 35, -- Heures contractuelles par semaine
    role user_role_enum DEFAULT 'Salarie',
    manager_id BIGINT REFERENCES salarie(id) ON DELETE SET NULL, -- Hiérarchie
    avatar_url VARCHAR(255),
    derniere_connexion TIMESTAMP,
    token_reset_password VARCHAR(255),
    token_expiration TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_salarie_email ON salarie(email);
CREATE INDEX idx_salarie_matricule ON salarie(matricule);
CREATE INDEX idx_salarie_fonction ON salarie(salarie_fonction_id);
CREATE INDEX idx_salarie_status ON salarie(salarie_status_id);
CREATE INDEX idx_salarie_manager ON salarie(manager_id);
CREATE INDEX idx_salarie_actif ON salarie(actif);

-- Ajouter la FK responsable_id sur projet maintenant que salarie existe
ALTER TABLE projet ADD CONSTRAINT fk_projet_responsable 
    FOREIGN KEY (responsable_id) REFERENCES salarie(id) ON DELETE SET NULL;

-- =====================================================
-- TABLE: tache_type
-- =====================================================
CREATE TABLE tache_type (
    id BIGSERIAL PRIMARY KEY,
    tache_type VARCHAR(250) NOT NULL,
    code VARCHAR(20) UNIQUE, -- Code court pour la tâche
    is_default BOOLEAN DEFAULT FALSE,
    is_facturable BOOLEAN DEFAULT TRUE, -- Amélioration: tâche facturable ou non
    couleur VARCHAR(7) DEFAULT '#10B981', -- Couleur pour l'UI
    ordre INTEGER DEFAULT 0, -- Ordre d'affichage
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tache_type_code ON tache_type(code);
CREATE INDEX idx_tache_type_default ON tache_type(is_default);

-- =====================================================
-- TABLE: tache_projet (liaison projet-tâches avec budget)
-- =====================================================
CREATE TABLE tache_projet (
    id BIGSERIAL PRIMARY KEY,
    projet_id BIGINT NOT NULL REFERENCES projet(id) ON DELETE CASCADE,
    tache_type_id BIGINT REFERENCES tache_type(id) ON DELETE CASCADE, -- Nullable pour permettre des tâches sans type global
    nom_tache VARCHAR(250), -- Nom personnalisé de la tâche pour ce projet (indépendant des autres projets)
    heures_prevues INTEGER DEFAULT 0, -- Heures budgétées pour cette tâche sur ce projet
    taux_horaire DECIMAL(10,2) DEFAULT 50.00, -- Taux horaire pour facturation
    description TEXT,
    couleur VARCHAR(7) DEFAULT '#10B981', -- Couleur pour l'affichage
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(projet_id, tache_type_id)
);

CREATE INDEX idx_tache_projet_projet ON tache_projet(projet_id);
CREATE INDEX idx_tache_projet_tache ON tache_projet(tache_type_id);
CREATE INDEX idx_tache_projet_nom_tache ON tache_projet(nom_tache);

-- =====================================================
-- TABLE: tache_projet_salarie (affectation salariés aux tâches projet)
-- =====================================================
CREATE TABLE tache_projet_salarie (
    id BIGSERIAL PRIMARY KEY,
    projet_id BIGINT NOT NULL REFERENCES projet(id) ON DELETE CASCADE,
    tache_type_id BIGINT REFERENCES tache_type(id) ON DELETE CASCADE, -- Nullable pour supporter les tâches personnalisées
    tache_projet_id BIGINT NOT NULL REFERENCES tache_projet(id) ON DELETE CASCADE,
    salarie_id BIGINT NOT NULL REFERENCES salarie(id) ON DELETE CASCADE,
    date_affectation DATE DEFAULT CURRENT_DATE,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tache_projet_id, salarie_id)
);

CREATE INDEX idx_tps_projet ON tache_projet_salarie(projet_id);
CREATE INDEX idx_tps_salarie ON tache_projet_salarie(salarie_id);
CREATE INDEX idx_tps_tache_projet ON tache_projet_salarie(tache_projet_id);

-- =====================================================
-- TABLE: salarie_pointage (pointage hebdomadaire)
-- =====================================================
CREATE TABLE salarie_pointage (
    id BIGSERIAL PRIMARY KEY,
    salarie_id BIGINT NOT NULL REFERENCES salarie(id) ON DELETE CASCADE,
    projet_id BIGINT NOT NULL REFERENCES projet(id) ON DELETE CASCADE,
    tache_type_id BIGINT NOT NULL REFERENCES tache_type(id) ON DELETE CASCADE,
    annee SMALLINT NOT NULL CHECK (annee >= 2020 AND annee <= 2100),
    semaine SMALLINT NOT NULL CHECK (semaine >= 1 AND semaine <= 53),
    heure_lundi DECIMAL(4,2) DEFAULT 0 CHECK (heure_lundi >= 0 AND heure_lundi <= 24),
    heure_mardi DECIMAL(4,2) DEFAULT 0 CHECK (heure_mardi >= 0 AND heure_mardi <= 24),
    heure_mercredi DECIMAL(4,2) DEFAULT 0 CHECK (heure_mercredi >= 0 AND heure_mercredi <= 24),
    heure_jeudi DECIMAL(4,2) DEFAULT 0 CHECK (heure_jeudi >= 0 AND heure_jeudi <= 24),
    heure_vendredi DECIMAL(4,2) DEFAULT 0 CHECK (heure_vendredi >= 0 AND heure_vendredi <= 24),
    heure_samedi DECIMAL(4,2) DEFAULT 0 CHECK (heure_samedi >= 0 AND heure_samedi <= 24),
    heure_dimanche DECIMAL(4,2) DEFAULT 0 CHECK (heure_dimanche >= 0 AND heure_dimanche <= 24),
    date_lundi DATE,
    date_mardi DATE,
    date_mercredi DATE,
    date_jeudi DATE,
    date_vendredi DATE,
    date_samedi DATE,
    date_dimanche DATE,
    -- Améliorations
    commentaire TEXT,
    validation_status validation_status_enum DEFAULT 'Brouillon',
    valide_par BIGINT REFERENCES salarie(id) ON DELETE SET NULL,
    date_validation TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Contrainte unique: un seul pointage par salarié/projet/tâche/semaine
    UNIQUE(salarie_id, projet_id, tache_type_id, annee, semaine)
);

CREATE INDEX idx_pointage_salarie ON salarie_pointage(salarie_id);
CREATE INDEX idx_pointage_projet ON salarie_pointage(projet_id);
CREATE INDEX idx_pointage_semaine ON salarie_pointage(annee, semaine);
CREATE INDEX idx_pointage_validation ON salarie_pointage(validation_status);

-- =====================================================
-- TABLE: salarie_cp (congés payés hebdomadaires)
-- =====================================================
CREATE TABLE salarie_cp (
    id BIGSERIAL PRIMARY KEY,
    salarie_id BIGINT NOT NULL REFERENCES salarie(id) ON DELETE CASCADE,
    annee SMALLINT NOT NULL CHECK (annee >= 2020 AND annee <= 2100),
    semaine SMALLINT NOT NULL CHECK (semaine >= 1 AND semaine <= 53),
    cp_lundi BOOLEAN DEFAULT FALSE,
    cp_mardi BOOLEAN DEFAULT FALSE,
    cp_mercredi BOOLEAN DEFAULT FALSE,
    cp_jeudi BOOLEAN DEFAULT FALSE,
    cp_vendredi BOOLEAN DEFAULT FALSE,
    cp_samedi BOOLEAN DEFAULT FALSE,
    cp_dimanche BOOLEAN DEFAULT FALSE,
    date_lundi DATE,
    date_mardi DATE,
    date_mercredi DATE,
    date_jeudi DATE,
    date_vendredi DATE,
    date_samedi DATE,
    date_dimanche DATE,
    -- Améliorations
    type_conge conge_type_enum DEFAULT 'CP',
    motif VARCHAR(255),
    validation_status validation_status_enum DEFAULT 'Brouillon',
    valide_par BIGINT REFERENCES salarie(id) ON DELETE SET NULL,
    date_validation TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(salarie_id, annee, semaine, type_conge)
);

CREATE INDEX idx_cp_salarie ON salarie_cp(salarie_id);
CREATE INDEX idx_cp_semaine ON salarie_cp(annee, semaine);
CREATE INDEX idx_cp_validation ON salarie_cp(validation_status);

-- =====================================================
-- TABLES SUPPLÉMENTAIRES (Améliorations)
-- =====================================================

-- =====================================================
-- TABLE: jour_ferie (jours fériés)
-- =====================================================
CREATE TABLE jour_ferie (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    nom VARCHAR(100) NOT NULL,
    pays_id BIGINT REFERENCES pays(id) ON DELETE CASCADE,
    annee SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM date)::SMALLINT) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ferie_date ON jour_ferie(date);
CREATE INDEX idx_ferie_annee ON jour_ferie(annee);

-- =====================================================
-- TABLE: validation_semaine (validation globale d'une semaine)
-- =====================================================
CREATE TABLE validation_semaine (
    id BIGSERIAL PRIMARY KEY,
    salarie_id BIGINT NOT NULL REFERENCES salarie(id) ON DELETE CASCADE,
    annee SMALLINT NOT NULL,
    semaine SMALLINT NOT NULL,
    status validation_status_enum DEFAULT 'Brouillon',
    total_heures DECIMAL(5,2) DEFAULT 0,
    valide_par BIGINT REFERENCES salarie(id) ON DELETE SET NULL,
    date_soumission TIMESTAMP,
    date_validation TIMESTAMP,
    commentaire_validation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(salarie_id, annee, semaine)
);

CREATE INDEX idx_validation_salarie ON validation_semaine(salarie_id);
CREATE INDEX idx_validation_semaine ON validation_semaine(annee, semaine);

-- =====================================================
-- TABLE: notification (système de notifications)
-- =====================================================
CREATE TABLE notification (
    id BIGSERIAL PRIMARY KEY,
    salarie_id BIGINT NOT NULL REFERENCES salarie(id) ON DELETE CASCADE,
    titre VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- info, warning, error, success
    lu BOOLEAN DEFAULT FALSE,
    lien VARCHAR(255), -- Lien vers la ressource concernée
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_salarie ON notification(salarie_id);
CREATE INDEX idx_notification_lu ON notification(lu);

-- =====================================================
-- TABLE: audit_log (historique des modifications)
-- =====================================================
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id BIGINT NOT NULL,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    salarie_id BIGINT REFERENCES salarie(id) ON DELETE SET NULL,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_table ON audit_log(table_name);
CREATE INDEX idx_audit_record ON audit_log(record_id);
CREATE INDEX idx_audit_salarie ON audit_log(salarie_id);
CREATE INDEX idx_audit_date ON audit_log(created_at);

-- =====================================================
-- TABLE: parametre (paramètres système)
-- =====================================================
CREATE TABLE parametre (
    id BIGSERIAL PRIMARY KEY,
    cle VARCHAR(100) NOT NULL UNIQUE,
    valeur TEXT,
    description VARCHAR(255),
    type VARCHAR(20) DEFAULT 'string', -- string, number, boolean, json
    modifiable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- FONCTIONS UTILITAIRES
-- =====================================================

-- Fonction pour calculer le total d'heures d'un pointage
CREATE OR REPLACE FUNCTION calc_total_heures_pointage(p salarie_pointage)
RETURNS DECIMAL AS $$
BEGIN
    RETURN COALESCE(p.heure_lundi, 0) + COALESCE(p.heure_mardi, 0) + 
           COALESCE(p.heure_mercredi, 0) + COALESCE(p.heure_jeudi, 0) + 
           COALESCE(p.heure_vendredi, 0) + COALESCE(p.heure_samedi, 0) + 
           COALESCE(p.heure_dimanche, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour obtenir le lundi d'une semaine ISO
CREATE OR REPLACE FUNCTION get_monday_of_week(p_year INTEGER, p_week INTEGER)
RETURNS DATE AS $$
BEGIN
    RETURN DATE_TRUNC('week', MAKE_DATE(p_year, 1, 4) + (p_week - 1) * INTERVAL '1 week')::DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger sur les tables principales
CREATE TRIGGER update_client_updated_at BEFORE UPDATE ON client FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projet_updated_at BEFORE UPDATE ON projet FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_salarie_updated_at BEFORE UPDATE ON salarie FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pointage_updated_at BEFORE UPDATE ON salarie_pointage FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cp_updated_at BEFORE UPDATE ON salarie_cp FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tache_type_updated_at BEFORE UPDATE ON tache_type FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tache_projet_updated_at BEFORE UPDATE ON tache_projet FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VUES UTILES
-- =====================================================

-- Vue: Résumé des heures par salarié et semaine
CREATE OR REPLACE VIEW v_heures_semaine AS
SELECT 
    sp.salarie_id,
    s.nom || ' ' || s.prenom AS salarie_nom,
    sp.annee,
    sp.semaine,
    SUM(COALESCE(sp.heure_lundi, 0) + COALESCE(sp.heure_mardi, 0) + 
        COALESCE(sp.heure_mercredi, 0) + COALESCE(sp.heure_jeudi, 0) + 
        COALESCE(sp.heure_vendredi, 0) + COALESCE(sp.heure_samedi, 0) + 
        COALESCE(sp.heure_dimanche, 0)) AS total_heures,
    COUNT(DISTINCT sp.projet_id) AS nb_projets
FROM salarie_pointage sp
JOIN salarie s ON s.id = sp.salarie_id
GROUP BY sp.salarie_id, s.nom, s.prenom, sp.annee, sp.semaine;

-- Vue: Résumé des heures par projet
CREATE OR REPLACE VIEW v_heures_projet AS
SELECT 
    p.id AS projet_id,
    p.nom AS projet_nom,
    p.code_projet,
    c.nom AS client_nom,
    SUM(COALESCE(sp.heure_lundi, 0) + COALESCE(sp.heure_mardi, 0) + 
        COALESCE(sp.heure_mercredi, 0) + COALESCE(sp.heure_jeudi, 0) + 
        COALESCE(sp.heure_vendredi, 0) + COALESCE(sp.heure_samedi, 0) + 
        COALESCE(sp.heure_dimanche, 0)) AS heures_realisees,
    p.budget_heures AS heures_prevues,
    COUNT(DISTINCT sp.salarie_id) AS nb_salaries
FROM projet p
LEFT JOIN client c ON c.id = p.client_id
LEFT JOIN salarie_pointage sp ON sp.projet_id = p.id
GROUP BY p.id, p.nom, p.code_projet, c.nom, p.budget_heures;

-- =====================================================
-- DONNÉES INITIALES
-- =====================================================

-- Statuts de projet
INSERT INTO projet_status (status, description, couleur) VALUES
('En_cours', 'Projet en cours de réalisation', '#3B82F6'),
('Stoppe', 'Projet temporairement arrêté', '#F59E0B'),
('Termine', 'Projet terminé', '#10B981'),
('Annule', 'Projet annulé', '#EF4444');

-- Fonctions des salariés
INSERT INTO salarie_fonction (fonction, description, taux_horaire_defaut) VALUES
('Cableur', 'Câbleur électrique', 35.00),
('DAO', 'Dessinateur Assisté par Ordinateur', 45.00),
('Prog', 'Programmeur automate', 55.00),
('Chef_Projet', 'Chef de projet', 65.00),
('Admin', 'Administrateur système', 50.00),
('Autre', 'Autre fonction', 40.00);

-- Statuts des salariés
INSERT INTO salarie_status (status, description) VALUES
('Salarie', 'Salarié en CDI/CDD'),
('Interim', 'Intérimaire'),
('Sous_traitant', 'Sous-traitant'),
('Apprentissage', 'Contrat d''apprentissage'),
('Stage', 'Stagiaire'),
('Autre', 'Autre statut');

-- Types de tâches par défaut
INSERT INTO tache_type (tache_type, code, is_default, is_facturable, couleur, ordre) VALUES
('Câblage', 'CAB', TRUE, TRUE, '#3B82F6', 1),
('Programmation', 'PROG', TRUE, TRUE, '#8B5CF6', 2),
('DAO / Plans', 'DAO', TRUE, TRUE, '#10B981', 3),
('Mise en service', 'MES', TRUE, TRUE, '#F59E0B', 4),
('Formation', 'FORM', FALSE, TRUE, '#EC4899', 5),
('Réunion', 'REU', FALSE, FALSE, '#6B7280', 6),
('Support / SAV', 'SAV', FALSE, TRUE, '#EF4444', 7),
('Administratif', 'ADM', FALSE, FALSE, '#9CA3AF', 8);

-- Paramètres système
INSERT INTO parametre (cle, valeur, description, type) VALUES
('heures_semaine_standard', '35', 'Nombre d''heures standard par semaine', 'number'),
('taux_horaire_defaut', '50', 'Taux horaire par défaut (€)', 'number'),
('validation_auto', 'false', 'Validation automatique des pointages', 'boolean'),
('rappel_pointage', 'true', 'Envoyer rappels de pointage', 'boolean'),
('jour_cloture_semaine', '5', 'Jour de clôture (1=Lundi, 7=Dimanche)', 'number'),
('delai_modification_jours', '7', 'Délai pour modifier un pointage (jours)', 'number');

-- Jours fériés français 2024-2025
INSERT INTO jour_ferie (date, nom) VALUES
-- 2024
('2024-01-01', 'Jour de l''An'),
('2024-04-01', 'Lundi de Pâques'),
('2024-05-01', 'Fête du Travail'),
('2024-05-08', 'Victoire 1945'),
('2024-05-09', 'Ascension'),
('2024-05-20', 'Lundi de Pentecôte'),
('2024-07-14', 'Fête Nationale'),
('2024-08-15', 'Assomption'),
('2024-11-01', 'Toussaint'),
('2024-11-11', 'Armistice'),
('2024-12-25', 'Noël'),
-- 2025
('2025-01-01', 'Jour de l''An'),
('2025-04-21', 'Lundi de Pâques'),
('2025-05-01', 'Fête du Travail'),
('2025-05-08', 'Victoire 1945'),
('2025-05-29', 'Ascension'),
('2025-06-09', 'Lundi de Pentecôte'),
('2025-07-14', 'Fête Nationale'),
('2025-08-15', 'Assomption'),
('2025-11-01', 'Toussaint'),
('2025-11-11', 'Armistice'),
('2025-12-25', 'Noël'),
-- 2026
('2026-01-01', 'Jour de l''An'),
('2026-04-06', 'Lundi de Pâques'),
('2026-05-01', 'Fête du Travail'),
('2026-05-08', 'Victoire 1945'),
('2026-05-14', 'Ascension'),
('2026-05-25', 'Lundi de Pentecôte'),
('2026-07-14', 'Fête Nationale'),
('2026-08-15', 'Assomption'),
('2026-11-01', 'Toussaint'),
('2026-11-11', 'Armistice'),
('2026-12-25', 'Noël');

-- Compte admin par défaut (mot de passe: Admin123!)
INSERT INTO salarie (nom, prenom, email, password_hash, role, actif, salarie_fonction_id, salarie_status_id, matricule)
VALUES (
    'Admin', 
    'Chronova', 
    'admin@chronova.local',
    '$2a$10$rQnM1.VuZJR8Y0G8L5Q5UeVv8ZrKQ8GvV3kJ5Qg0Y6XvWq3L5Z5Yi', -- Admin123!
    'Admin',
    TRUE,
    (SELECT id FROM salarie_fonction WHERE fonction = 'Admin'),
    (SELECT id FROM salarie_status WHERE status = 'Salarie'),
    'ADM001'
);

-- =====================================================
-- GRANT PERMISSIONS (à adapter selon vos besoins)
-- =====================================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO chronova_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO chronova_user;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

-- =====================================================
-- DONNÉES DES PAYS (239 pays)
-- =====================================================
INSERT INTO pays (id, country_name, country_code, country_code2) VALUES
(1, 'Aruba', 'ABW', 'AW'),
(2, 'Afghanistan', 'AFG', 'AF'),
(3, 'Angola', 'AGO', 'AO'),
(4, 'Anguilla', 'AIA', 'AI'),
(5, 'Albania', 'ALB', 'AL'),
(6, 'Andorra', 'AND', 'AD'),
(7, 'Netherlands Antilles', 'ANT', 'AN'),
(8, 'United Arab Emirates', 'ARE', 'AE'),
(9, 'Argentina', 'ARG', 'AR'),
(10, 'Armenia', 'ARM', 'AM'),
(11, 'American Samoa', 'ASM', 'AS'),
(12, 'Antarctica', 'ATA', 'AQ'),
(13, 'French Southern territories', 'ATF', 'TF'),
(14, 'Antigua and Barbuda', 'ATG', 'AG'),
(15, 'Australia', 'AUS', 'AU'),
(16, 'Austria', 'AUT', 'AT'),
(17, 'Azerbaijan', 'AZE', 'AZ'),
(18, 'Burundi', 'BDI', 'BI'),
(19, 'Belgium', 'BEL', 'BE'),
(20, 'Benin', 'BEN', 'BJ'),
(21, 'Burkina Faso', 'BFA', 'BF'),
(22, 'Bangladesh', 'BGD', 'BD'),
(23, 'Bulgaria', 'BGR', 'BG'),
(24, 'Bahrain', 'BHR', 'BH'),
(25, 'Bahamas', 'BHS', 'BS'),
(26, 'Bosnia and Herzegovina', 'BIH', 'BA'),
(27, 'Belarus', 'BLR', 'BY'),
(28, 'Belize', 'BLZ', 'BZ'),
(29, 'Bermuda', 'BMU', 'BM'),
(30, 'Bolivia', 'BOL', 'BO'),
(31, 'Brazil', 'BRA', 'BR'),
(32, 'Barbados', 'BRB', 'BB'),
(33, 'Brunei', 'BRN', 'BN'),
(34, 'Bhutan', 'BTN', 'BT'),
(35, 'Bouvet Island', 'BVT', 'BV'),
(36, 'Botswana', 'BWA', 'BW'),
(37, 'Central African Republic', 'CAF', 'CF'),
(38, 'Canada', 'CAN', 'CA'),
(39, 'Cocos (Keeling) Islands', 'CCK', 'CC'),
(40, 'Switzerland', 'CHE', 'CH'),
(41, 'Chile', 'CHL', 'CL'),
(42, 'China', 'CHN', 'CN'),
(43, 'CÃƒÂ´te dÃ¢â‚¬â„¢Ivoire', 'CIV', 'CI'),
(44, 'Cameroon', 'CMR', 'CM'),
(45, 'Congo, The Democratic Republic of the', 'COD', 'CD'),
(46, 'Congo', 'COG', 'CG'),
(47, 'Cook Islands', 'COK', 'CK'),
(48, 'Colombia', 'COL', 'CO'),
(49, 'Comoros', 'COM', 'KM'),
(50, 'Cape Verde', 'CPV', 'CV'),
(51, 'Costa Rica', 'CRI', 'CR'),
(52, 'Cuba', 'CUB', 'CU'),
(53, 'Christmas Island', 'CXR', 'CX'),
(54, 'Cayman Islands', 'CYM', 'KY'),
(55, 'Cyprus', 'CYP', 'CY'),
(56, 'Czech Republic', 'CZE', 'CZ'),
(57, 'Germany', 'DEU', 'DE'),
(58, 'Djibouti', 'DJI', 'DJ'),
(59, 'Dominica', 'DMA', 'DM'),
(60, 'Denmark', 'DNK', 'DK'),
(61, 'Dominican Republic', 'DOM', 'DO'),
(62, 'Algeria', 'DZA', 'DZ'),
(63, 'Ecuador', 'ECU', 'EC'),
(64, 'Egypt', 'EGY', 'EG'),
(65, 'Eritrea', 'ERI', 'ER'),
(66, 'Western Sahara', 'ESH', 'EH'),
(67, 'Spain', 'ESP', 'ES'),
(68, 'Estonia', 'EST', 'EE'),
(69, 'Ethiopia', 'ETH', 'ET'),
(70, 'Finland', 'FIN', 'FI'),
(71, 'Fiji Islands', 'FJI', 'FJ'),
(72, 'Falkland Islands', 'FLK', 'FK'),
(73, 'France', 'FRA', 'FR'),
(74, 'Faroe Islands', 'FRO', 'FO'),
(75, 'Micronesia, Federated States of', 'FSM', 'FM'),
(76, 'Gabon', 'GAB', 'GA'),
(77, 'United Kingdom', 'GBR', 'GB'),
(78, 'Georgia', 'GEO', 'GE'),
(79, 'Ghana', 'GHA', 'GH'),
(80, 'Gibraltar', 'GIB', 'GI'),
(81, 'Guinea', 'GIN', 'GN'),
(82, 'Guadeloupe', 'GLP', 'GP'),
(83, 'Gambia', 'GMB', 'GM'),
(84, 'Guinea-Bissau', 'GNB', 'GW'),
(85, 'Equatorial Guinea', 'GNQ', 'GQ'),
(86, 'Greece', 'GRC', 'GR'),
(87, 'Grenada', 'GRD', 'GD'),
(88, 'Greenland', 'GRL', 'GL'),
(89, 'Guatemala', 'GTM', 'GT'),
(90, 'French Guiana', 'GUF', 'GF'),
(91, 'Guam', 'GUM', 'GU'),
(92, 'Guyana', 'GUY', 'GY'),
(93, 'Hong Kong', 'HKG', 'HK'),
(94, 'Heard Island and McDonald Islands', 'HMD', 'HM'),
(95, 'Honduras', 'HND', 'HN'),
(96, 'Croatia', 'HRV', 'HR'),
(97, 'Haiti', 'HTI', 'HT'),
(98, 'Hungary', 'HUN', 'HU'),
(99, 'Indonesia', 'IDN', 'ID'),
(100, 'India', 'IND', 'IN'),
(101, 'British Indian Ocean Territory', 'IOT', 'IO'),
(102, 'Ireland', 'IRL', 'IE'),
(103, 'Iran', 'IRN', 'IR'),
(104, 'Iraq', 'IRQ', 'IQ'),
(105, 'Iceland', 'ISL', 'IS'),
(106, 'Israel', 'ISR', 'IL'),
(107, 'Italy', 'ITA', 'IT'),
(108, 'Jamaica', 'JAM', 'JM'),
(109, 'Jordan', 'JOR', 'JO'),
(110, 'Japan', 'JPN', 'JP'),
(111, 'Kazakstan', 'KAZ', 'KZ'),
(112, 'Kenya', 'KEN', 'KE'),
(113, 'Kyrgyzstan', 'KGZ', 'KG'),
(114, 'Cambodia', 'KHM', 'KH'),
(115, 'Kiribati', 'KIR', 'KI'),
(116, 'Saint Kitts and Nevis', 'KNA', 'KN'),
(117, 'South Korea', 'KOR', 'KR'),
(118, 'Kuwait', 'KWT', 'KW'),
(119, 'Laos', 'LAO', 'LA'),
(120, 'Lebanon', 'LBN', 'LB'),
(121, 'Liberia', 'LBR', 'LR'),
(122, 'Libyan Arab Jamahiriya', 'LBY', 'LY'),
(123, 'Saint Lucia', 'LCA', 'LC'),
(124, 'Liechtenstein', 'LIE', 'LI'),
(125, 'Sri Lanka', 'LKA', 'LK'),
(126, 'Lesotho', 'LSO', 'LS'),
(127, 'Lithuania', 'LTU', 'LT'),
(128, 'Luxembourg', 'LUX', 'LU'),
(129, 'Latvia', 'LVA', 'LV'),
(130, 'Macao', 'MAC', 'MO'),
(131, 'Morocco', 'MAR', 'MA'),
(132, 'Monaco', 'MCO', 'MC'),
(133, 'Moldova', 'MDA', 'MD'),
(134, 'Madagascar', 'MDG', 'MG'),
(135, 'Maldives', 'MDV', 'MV'),
(136, 'Mexico', 'MEX', 'MX'),
(137, 'Marshall Islands', 'MHL', 'MH'),
(138, 'Macedonia', 'MKD', 'MK'),
(139, 'Mali', 'MLI', 'ML'),
(140, 'Malta', 'MLT', 'MT'),
(141, 'Myanmar', 'MMR', 'MM'),
(142, 'Mongolia', 'MNG', 'MN'),
(143, 'Northern Mariana Islands', 'MNP', 'MP'),
(144, 'Mozambique', 'MOZ', 'MZ'),
(145, 'Mauritania', 'MRT', 'MR'),
(146, 'Montserrat', 'MSR', 'MS'),
(147, 'Martinique', 'MTQ', 'MQ'),
(148, 'Mauritius', 'MUS', 'MU'),
(149, 'Malawi', 'MWI', 'MW'),
(150, 'Malaysia', 'MYS', 'MY'),
(151, 'Mayotte', 'MYT', 'YT'),
(152, 'Namibia', 'NAM', 'NA'),
(153, 'New Caledonia', 'NCL', 'NC'),
(154, 'Niger', 'NER', 'NE'),
(155, 'Norfolk Island', 'NFK', 'NF'),
(156, 'Nigeria', 'NGA', 'NG'),
(157, 'Nicaragua', 'NIC', 'NI'),
(158, 'Niue', 'NIU', 'NU'),
(159, 'Netherlands', 'NLD', 'NL'),
(160, 'Norway', 'NOR', 'NO'),
(161, 'Nepal', 'NPL', 'NP'),
(162, 'Nauru', 'NRU', 'NR'),
(163, 'New Zealand', 'NZL', 'NZ'),
(164, 'Oman', 'OMN', 'OM'),
(165, 'Pakistan', 'PAK', 'PK'),
(166, 'Panama', 'PAN', 'PA'),
(167, 'Pitcairn', 'PCN', 'PN'),
(168, 'Peru', 'PER', 'PE'),
(169, 'Philippines', 'PHL', 'PH'),
(170, 'Palau', 'PLW', 'PW'),
(171, 'Papua New Guinea', 'PNG', 'PG'),
(172, 'Poland', 'POL', 'PL'),
(173, 'Puerto Rico', 'PRI', 'PR'),
(174, 'North Korea', 'PRK', 'KP'),
(175, 'Portugal', 'PRT', 'PT'),
(176, 'Paraguay', 'PRY', 'PY'),
(177, 'Palestine', 'PSE', 'PS'),
(178, 'French Polynesia', 'PYF', 'PF'),
(179, 'Qatar', 'QAT', 'QA'),
(180, 'RÃƒÂ©union', 'REU', 'RE'),
(181, 'Romania', 'ROM', 'RO'),
(182, 'Russian Federation', 'RUS', 'RU'),
(183, 'Rwanda', 'RWA', 'RW'),
(184, 'Saudi Arabia', 'SAU', 'SA'),
(185, 'Sudan', 'SDN', 'SD'),
(186, 'Senegal', 'SEN', 'SN'),
(187, 'Singapore', 'SGP', 'SG'),
(188, 'South Georgia and the South Sandwich Islands', 'SGS', 'GS'),
(189, 'Saint Helena', 'SHN', 'SH'),
(190, 'Svalbard and Jan Mayen', 'SJM', 'SJ'),
(191, 'Solomon Islands', 'SLB', 'SB'),
(192, 'Sierra Leone', 'SLE', 'SL'),
(193, 'El Salvador', 'SLV', 'SV'),
(194, 'San Marino', 'SMR', 'SM'),
(195, 'Somalia', 'SOM', 'SO'),
(196, 'Saint Pierre and Miquelon', 'SPM', 'PM'),
(197, 'Sao Tome and Principe', 'STP', 'ST'),
(198, 'Suriname', 'SUR', 'SR'),
(199, 'Slovakia', 'SVK', 'SK'),
(200, 'Slovenia', 'SVN', 'SI'),
(201, 'Sweden', 'SWE', 'SE'),
(202, 'Swaziland', 'SWZ', 'SZ'),
(203, 'Seychelles', 'SYC', 'SC'),
(204, 'Syria', 'SYR', 'SY'),
(205, 'Turks and Caicos Islands', 'TCA', 'TC'),
(206, 'Chad', 'TCD', 'TD'),
(207, 'Togo', 'TGO', 'TG'),
(208, 'Thailand', 'THA', 'TH'),
(209, 'Tajikistan', 'TJK', 'TJ'),
(210, 'Tokelau', 'TKL', 'TK'),
(211, 'Turkmenistan', 'TKM', 'TM'),
(212, 'East Timor', 'TMP', 'TP'),
(213, 'Tonga', 'TON', 'TO'),
(214, 'Trinidad and Tobago', 'TTO', 'TT'),
(215, 'Tunisia', 'TUN', 'TN'),
(216, 'Turkey', 'TUR', 'TR'),
(217, 'Tuvalu', 'TUV', 'TV'),
(218, 'Taiwan', 'TWN', 'TW'),
(219, 'Tanzania', 'TZA', 'TZ'),
(220, 'Uganda', 'UGA', 'UG'),
(221, 'Ukraine', 'UKR', 'UA'),
(222, 'United States Minor Outlying Islands', 'UMI', 'UM'),
(223, 'Uruguay', 'URY', 'UY'),
(224, 'United States', 'USA', 'US'),
(225, 'Uzbekistan', 'UZB', 'UZ'),
(226, 'Holy See (Vatican City State)', 'VAT', 'VA'),
(227, 'Saint Vincent and the Grenadines', 'VCT', 'VC'),
(228, 'Venezuela', 'VEN', 'VE'),
(229, 'Virgin Islands, British', 'VGB', 'VG'),
(230, 'Virgin Islands, U.S.', 'VIR', 'VI'),
(231, 'Vietnam', 'VNM', 'VN'),
(232, 'Vanuatu', 'VUT', 'VU'),
(233, 'Wallis and Futuna', 'WLF', 'WF'),
(234, 'Samoa', 'WSM', 'WS'),
(235, 'Yemen', 'YEM', 'YE'),
(236, 'Yugoslavia', 'YUG', 'YU'),
(237, 'South Africa', 'ZAF', 'ZA'),
(238, 'Zambia', 'ZMB', 'ZM'),
(239, 'Zimbabwe', 'ZWE', 'ZW');

-- Reset de la séquence pays après insertion
SELECT setval('pays_id_seq', (SELECT MAX(id) FROM pays));