-- Synchroniser les couleurs des tâches déjà créées :
-- Pour les tâches liées à un `tache_type` (tache_type_id NOT NULL), la couleur doit être cohérente
-- entre projets => on l'aligne sur `tache_type.couleur` quand la tâche projet a une couleur vide
-- ou la couleur par défaut.
--
-- On ne touche PAS aux tâches personnalisées (tache_type_id IS NULL).
-- On ne touche PAS aux tâches typées qui ont une couleur explicitement personnalisée (différente du défaut).

UPDATE tache_projet tp
SET couleur = tt.couleur
FROM tache_type tt
WHERE tp.tache_type_id = tt.id
  AND (
    tp.couleur IS NULL
    OR UPPER(TRIM(tp.couleur)) = '#10B981'
    OR UPPER(TRIM(tp.couleur)) = ''
  );

-- Optionnel: si vous voulez FORCER la couleur du type sur toutes les tâches typées,
-- décommentez le bloc ci-dessous (attention: écrase les personnalisations):
--
-- UPDATE tache_projet tp
-- SET couleur = tt.couleur
-- FROM tache_type tt
-- WHERE tp.tache_type_id = tt.id;

