-- AlterTable
ALTER TABLE "tache_projet" ADD COLUMN IF NOT EXISTS "nom_tache" VARCHAR(250);
ALTER TABLE "tache_projet" ADD COLUMN IF NOT EXISTS "couleur" VARCHAR(7) DEFAULT '#10B981';

-- Make tache_type_id nullable if not already
ALTER TABLE "tache_projet" ALTER COLUMN "tache_type_id" DROP NOT NULL;
