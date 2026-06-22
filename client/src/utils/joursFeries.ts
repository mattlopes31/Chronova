import { format } from 'date-fns';

export type JourFerieLike = { date: string; libelle?: string; nom?: string };

const ORDRE_JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

export function dateKeyLocal(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Clé calendrier en UTC (alignée sur `dates.lundi` / Prisma DATE sérialisée en ISO). */
export function dateKeyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ferieDateKeys(list: JourFerieLike[]): Set<string> {
  return new Set(
    list.map((j) => (j?.date ? String(j.date).split('T')[0] : '')).filter(Boolean)
  );
}

/**
 * Compte les jours fériés dans la semaine (lun–dim), crédit 7h si non pointé ce jour,
 * et les heures réellement saisies sur des jours fériés (considérées comme heures sup côté métier).
 */
export function computeFeriePourSemaine(
  joursSemaine: Date[],
  heuresParJour: Record<string, number>,
  joursFeries: JourFerieLike[],
  heuresParJourFerie: number = 7,
  dayDateKey: (d: Date) => string = dateKeyLocal
) {
  const keys = ferieDateKeys(joursFeries);
  let nbFeries = 0;
  let creditFerie = 0;
  let heuresTravailJoursFeries = 0;

  joursSemaine.forEach((d, idx) => {
    if (!d || isNaN(d.getTime())) return;
    const dk = dayDateKey(d);
    if (!keys.has(dk)) return;
    nbFeries += 1;
    const jour = ORDRE_JOURS[idx];
    const h = Number(heuresParJour[jour] || 0);
    if (h <= 0) {
      creditFerie += heuresParJourFerie;
    } else {
      heuresTravailJoursFeries += h;
    }
  });

  const heuresTravaillees = ORDRE_JOURS.reduce((s, j) => s + Number(heuresParJour[j] || 0), 0);
  const heuresTravailSansFerie = heuresTravaillees - heuresTravailJoursFeries;

  return {
    nbFeries,
    creditFerie,
    heuresTravailJoursFeries,
    heuresTravailSansFerie,
    heuresTravaillees,
  };
}

export function jourEstFerie(
  d: Date | undefined,
  joursFeries: JourFerieLike[],
  dayDateKey: (d: Date) => string = dateKeyLocal
): boolean {
  if (!d || isNaN(d.getTime())) return false;
  return ferieDateKeys(joursFeries).has(dayDateKey(d));
}
