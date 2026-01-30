-- Migration: Ajouter le champ code à la table tache_projet
-- Date: 2024

-- Ajouter la colonne code si elle n'existe pas déjà
ALTER TABLE tache_projet 
ADD COLUMN IF NOT EXISTS code VARCHAR(20);

-- Ajouter un index sur le champ code pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_tache_projet_code ON tache_projet(code);
