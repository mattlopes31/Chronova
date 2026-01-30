-- =====================================================
-- MIGRATION: Ajouter nom_tache et couleur à tache_projet
-- =====================================================
-- Ce script doit être exécuté dans votre base de données PostgreSQL
-- pour ajouter les colonnes nécessaires aux tâches personnalisées par projet.

-- 1. Ajouter la colonne nom_tache si elle n'existe pas
ALTER TABLE tache_projet 
ADD COLUMN IF NOT EXISTS nom_tache VARCHAR(250);

-- 2. Ajouter la colonne couleur si elle n'existe pas
ALTER TABLE tache_projet 
ADD COLUMN IF NOT EXISTS couleur VARCHAR(7) DEFAULT '#10B981';

-- 3. Rendre tache_type_id nullable si ce n'est pas déjà le cas
ALTER TABLE tache_projet 
ALTER COLUMN tache_type_id DROP NOT NULL;

-- 4. Créer un index sur nom_tache pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_tache_projet_nom_tache 
ON tache_projet(nom_tache);

-- 5. Vérification : Afficher la structure de la table
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'tache_projet'
ORDER BY ordinal_position;
