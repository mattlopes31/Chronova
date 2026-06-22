/** Forme plate (détails projet) ou imbriquée (liste projets) pour le tri par code. */
export type TacheSortable = {
  code?: string | null;
  nom_tache?: string | null;
  nom?: string | null;
  tache_type?: string | { tache_type?: string | null; code?: string | null } | null;
};

function tacheNomPourTri(a: TacheSortable): string {
  const tt = a.tache_type;
  const libelle =
    a.nom_tache ||
    (typeof tt === 'string' ? tt : tt?.tache_type) ||
    a.nom ||
    '';
  return libelle.toLowerCase();
}

/** Tri par code (numériques croissants), puis alphabétique sur le code ; sans code : fin, puis par libellé. */
export function sortTachesByCode(a: TacheSortable, b: TacheSortable): number {
  const codeA = (a.code || (typeof a.tache_type === 'object' && a.tache_type ? a.tache_type.code : '') || '').trim();
  const codeB = (b.code || (typeof b.tache_type === 'object' && b.tache_type ? b.tache_type.code : '') || '').trim();

  if (!codeA && !codeB) {
    const nomA = tacheNomPourTri(a);
    const nomB = tacheNomPourTri(b);
    return nomA.localeCompare(nomB, 'fr', { sensitivity: 'base' });
  }

  if (!codeA) return 1;
  if (!codeB) return -1;

  const isNumericA = /^\d+$/.test(codeA);
  const isNumericB = /^\d+$/.test(codeB);

  if (isNumericA && isNumericB) {
    return parseInt(codeA, 10) - parseInt(codeB, 10);
  }

  if (isNumericA && !isNumericB) return -1;
  if (!isNumericA && isNumericB) return 1;

  return codeA.localeCompare(codeB, 'fr', { sensitivity: 'base', numeric: true });
}
