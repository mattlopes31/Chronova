-- MIGRATION: Rendre tache_type_id nullable dans tache_projet_salarie
-- Pour supporter les tâches personnalisées (sans tache_type_id)

-- Rendre la colonne nullable
ALTER TABLE tache_projet_salarie 
ALTER COLUMN tache_type_id DROP NOT NULL;

-- Mettre à jour la contrainte de clé étrangère pour permettre NULL
-- (PostgreSQL permet déjà les clés étrangères NULL, donc pas besoin de modifier la FK)

-- Vérification
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tache_projet_salarie' 
AND column_name = 'tache_type_id';
