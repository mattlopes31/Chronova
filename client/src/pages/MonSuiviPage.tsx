import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertCircle,
  Info,
  X,
  TrendingUp,
} from 'lucide-react';
import { clsx } from 'clsx';
import { pointagesApi, congesApi } from '@/services/api';
import { Card, Spinner } from '@/components/ui';
import { formatHeuresQuart, getWeekDaysFromApiMonday } from '@/utils/dates';
import { dateKeyUTC, ferieDateKeys } from '@/utils/joursFeries';
import type { JourFerie } from '@/types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const NOMS_JOURS = [
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
] as const;

const LABELS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const JOURS_NOMS_LONGS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const ABSENCE_CONFIG: Record<string, { label: string; short: string; color: string }> = {
  CP:          { label: 'Congé Payé',  short: 'CP',  color: '#f59e0b' },
  RTT:         { label: 'RTT',         short: 'RTT', color: '#3b82f6' },
  Maladie:     { label: 'Maladie',     short: 'MAL', color: '#ef4444' },
  Deplacement: { label: 'Déplacement', short: 'DEP', color: '#8b5cf6' },
  Formation:   { label: 'Formation',   short: 'FOR', color: '#06b6d4' },
  Sans_solde:  { label: 'Sans solde',  short: 'SS',  color: '#6b7280' },
  Autre:       { label: 'Autre',       short: 'AUT', color: '#6b7280' },
};

// Clé du jour courant (locale, calculée une seule fois)
const TODAY_KEY = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

// ─── Types internes ───────────────────────────────────────────────────────────

interface LigneJour {
  projetId: string;
  projetNom: string;
  projetCode: string;
  tacheNom?: string;
  tacheCode?: string;
  tacheCouleur?: string;
  heures: number;
  status: string;
}

interface AbsenceJour {
  type: string;
  label: string;
  short: string;
  color: string;
}

interface JourData {
  dateKey: string;
  date: Date;
  jourNum: number;
  moisCourant: boolean;
  estWeekend: boolean;
  estFerie: boolean;
  ferieNom?: string;
  heuresTotal: number;
  absences: AbsenceJour[];
  lignes: LigneJour[];
}

interface SemaineCal {
  semaineNum: number;
  jours: JourData[];
  heuresMoisCourant: number;
  status: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// ─── Construction du calendrier ───────────────────────────────────────────────

function buildCalendar(
  mois: number,
  annee: number,
  pointages: any[],
  conges: any[],
  joursFeries: JourFerie[]
): SemaineCal[] {
  const ferieKeys = ferieDateKeys(joursFeries);
  const ferieNoms: Record<string, string> = {};
  joursFeries.forEach((jf) => {
    const key = String(jf.date).split('T')[0];
    ferieNoms[key] = jf.libelle || jf.nom || '';
  });

  const dayMap: Record<string, JourData> = {};

  const makeJour = (key: string, date: Date): JourData => {
    const dow = date.getUTCDay();
    return {
      dateKey: key,
      date,
      jourNum: date.getUTCDate(),
      moisCourant: date.getUTCMonth() + 1 === mois && date.getUTCFullYear() === annee,
      estWeekend: dow === 0 || dow === 6,
      estFerie: ferieKeys.has(key),
      ferieNom: ferieNoms[key],
      heuresTotal: 0,
      absences: [],
      lignes: [],
    };
  };

  const getOrCreate = (key: string, date: Date): JourData => {
    if (!dayMap[key]) dayMap[key] = makeJour(key, date);
    return dayMap[key];
  };

  // Mapper les pointages sur les jours
  pointages.forEach((p: any) => {
    const lundiStr = String(p.date_lundi || '').split('T')[0];
    if (!lundiStr) return;
    const weekDays = getWeekDaysFromApiMonday(lundiStr);
    if (weekDays.length !== 7) return;

    NOMS_JOURS.forEach((nom, i) => {
      const h = Number(p[`heure_${nom}`] || 0);
      const key = dateKeyUTC(weekDays[i]);
      const jour = getOrCreate(key, weekDays[i]);
      if (h > 0) {
        jour.heuresTotal += h;
        jour.lignes.push({
          projetId: String(p.projet?.id || p.projet_id || ''),
          projetNom: p.projet?.nom || '—',
          projetCode: p.projet?.code_projet || '',
          tacheNom: p.tache_type?.tache_type,
          tacheCode: p.tache_type?.code,
          tacheCouleur: p.tache_type?.couleur,
          heures: h,
          status: p.validation_status,
        });
      }
    });
  });

  // Mapper les absences/congés sur les jours
  conges.forEach((c: any) => {
    const lundiStr = String(c.date_lundi || '').split('T')[0];
    if (!lundiStr) return;
    const weekDays = getWeekDaysFromApiMonday(lundiStr);
    if (weekDays.length !== 7) return;

    NOMS_JOURS.forEach((nom, i) => {
      if (!c[`cp_${nom}`]) return;
      const type: string = c[`type_${nom}`] || c.type_conge || 'Autre';
      const cfg = ABSENCE_CONFIG[type] || ABSENCE_CONFIG['Autre'];
      const key = dateKeyUTC(weekDays[i]);
      const jour = getOrCreate(key, weekDays[i]);
      jour.absences.push({ type, label: cfg.label, short: cfg.short, color: cfg.color });
    });
  });

  // Construire les semaines du calendrier
  const firstOfMonth = new Date(Date.UTC(annee, mois - 1, 1, 12, 0, 0));
  const lastOfMonth  = new Date(Date.UTC(annee, mois, 0, 12, 0, 0));

  const offsetToMonday = (firstOfMonth.getUTCDay() + 6) % 7;
  let cur = new Date(Date.UTC(annee, mois - 1, 1 - offsetToMonday, 12, 0, 0));

  const semaines: SemaineCal[] = [];

  while (cur <= lastOfMonth) {
    const jours: JourData[] = [];

    for (let i = 0; i < 7; i++) {
      const key = dateKeyUTC(cur);
      jours.push(dayMap[key] ?? makeJour(key, new Date(cur)));
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 1, 12, 0, 0));
    }

    // Numéro de semaine ISO (via le jeudi)
    const semaineNum = isoWeekNumber(jours[3].date);

    // Total heures uniquement pour les jours du mois courant
    const heuresMoisCourant = jours.filter((j) => j.moisCourant).reduce((s, j) => s + j.heuresTotal, 0);

    // Statut dominant de la semaine
    const statusCount: Record<string, number> = {};
    jours.forEach((j) => j.lignes.forEach((l) => {
      statusCount[l.status] = (statusCount[l.status] || 0) + 1;
    }));

    let status: string | null = null;
    if (Object.keys(statusCount).length > 0) {
      if (statusCount['Valide'] && !statusCount['Brouillon'] && !statusCount['Soumis']) status = 'Valide';
      else if (statusCount['Rejete']) status = 'Rejete';
      else if (statusCount['Soumis']) status = 'Soumis';
      else if (statusCount['Brouillon']) status = 'Brouillon';
    }

    semaines.push({ semaineNum, jours, heuresMoisCourant, status });
  }

  return semaines;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export const MonSuiviPage = () => {
  const now = new Date();
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const isCurrentMonth = mois === now.getMonth() + 1 && annee === now.getFullYear();

  const navigateMois = (delta: number) => {
    let m = mois + delta;
    let y = annee;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMois(m);
    setAnnee(y);
    setSelectedKey(null);
  };

  const { data: pointages = [], isLoading: loadPt } = useQuery({
    queryKey: ['mes-pointages-suivi', annee],
    queryFn: () => pointagesApi.getAll({ annee }),
  });

  const { data: conges = [], isLoading: loadCo } = useQuery({
    queryKey: ['mes-conges-suivi', annee],
    queryFn: () => congesApi.getAll({ annee }),
  });

  const { data: joursFeries = [] } = useQuery({
    queryKey: ['jours-feries', annee],
    queryFn: () => congesApi.getJoursFeries(annee),
  });

  const semaines = useMemo(
    () => buildCalendar(mois, annee, pointages as any[], conges as any[], joursFeries),
    [mois, annee, pointages, conges, joursFeries]
  );

  // Stats mensuelles
  const stats = useMemo(() => {
    let totalH = 0;
    let joursPointes = 0;
    let joursAbsents = 0;
    let semainesValidees = 0;
    const projMap: Record<string, { nom: string; code: string; heures: number; taches: Record<string, { nom?: string; code?: string; couleur?: string; heures: number }> }> = {};

    semaines.forEach((s) => {
      const hasMois = s.jours.some((j) => j.moisCourant);
      if (hasMois && s.status === 'Valide') semainesValidees++;

      s.jours.forEach((j) => {
        if (!j.moisCourant) return;
        if (j.heuresTotal > 0) { totalH += j.heuresTotal; joursPointes++; }
        if (j.absences.length > 0) joursAbsents++;

        j.lignes.forEach((l) => {
          const pk = l.projetId || l.projetCode || l.projetNom;
          if (!projMap[pk]) projMap[pk] = { nom: l.projetNom, code: l.projetCode, heures: 0, taches: {} };
          projMap[pk].heures += l.heures;

          const tk = l.tacheCode || l.tacheNom || 'Autre';
          if (!projMap[pk].taches[tk]) projMap[pk].taches[tk] = { nom: l.tacheNom, code: l.tacheCode, couleur: l.tacheCouleur, heures: 0 };
          projMap[pk].taches[tk].heures += l.heures;
        });
      });
    });

    const projets = Object.values(projMap)
      .map((p) => ({ ...p, tachesListe: Object.values(p.taches).sort((a, b) => b.heures - a.heures) }))
      .sort((a, b) => b.heures - a.heures);

    return { totalH, joursPointes, joursAbsents, semainesValidees, projets };
  }, [semaines]);

  const selectedJour = useMemo(() => {
    if (!selectedKey) return null;
    for (const s of semaines) {
      const j = s.jours.find((j) => j.dateKey === selectedKey);
      if (j) return j;
    }
    return null;
  }, [selectedKey, semaines]);

  const isLoading = loadPt || loadCo;

  // Badge de statut semaine
  const StatusBadge = ({ status }: { status: string | null }) => {
    if (!status) return null;
    const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
      Valide:    { label: 'Validé',   cls: 'bg-green-100 text-green-700',  icon: <CheckCircle className="w-3 h-3" /> },
      Soumis:    { label: 'Soumis',   cls: 'bg-blue-100 text-blue-700',    icon: <Clock className="w-3 h-3" /> },
      Rejete:    { label: 'Rejeté',   cls: 'bg-red-100 text-red-700',      icon: <AlertCircle className="w-3 h-3" /> },
      Brouillon: { label: 'Brouillon',cls: 'bg-gray-100 text-gray-600',    icon: <Info className="w-3 h-3" /> },
    };
    const cfg = map[status];
    if (!cfg) return null;
    return (
      <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', cfg.cls)}>
        {cfg.icon} {cfg.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mon suivi mensuel</h1>
        <p className="text-gray-500 mt-1">Visualisez vos heures pointées jour par jour</p>
      </div>

      {/* Navigation mois + stats */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateMois(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-gray-900">
            {MOIS_LABELS[mois - 1]} {annee}
          </h2>
          <button
            onClick={() => navigateMois(1)}
            disabled={isCurrentMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-primary-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-primary-700">{formatHeuresQuart(stats.totalH)}</div>
            <div className="text-xs text-primary-600 mt-0.5">Heures pointées</div>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{stats.joursPointes}</div>
            <div className="text-xs text-green-600 mt-0.5">Jours travaillés</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{stats.joursAbsents}</div>
            <div className="text-xs text-amber-600 mt-0.5">Jours d'absence</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{stats.semainesValidees}</div>
            <div className="text-xs text-blue-600 mt-0.5">Semaines validées</div>
          </div>
        </div>
      </Card>

      {/* Calendrier */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-12">Sem.</th>
                  {LABELS_COURTS.map((l, i) => (
                    <th
                      key={l}
                      className={clsx(
                        'px-2 py-3 text-center text-xs font-semibold uppercase w-[calc((100%-theme(spacing.12)-theme(spacing.28)-theme(spacing.28))/7)]',
                        i >= 5 ? 'text-gray-400' : 'text-gray-500'
                      )}
                    >
                      {l}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">Total</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-28">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {semaines.map((sem) => (
                  <tr key={sem.semaineNum} className="hover:bg-gray-50/40 transition-colors">
                    <td className="px-3 py-3 text-xs font-medium text-gray-400 align-top">
                      S{sem.semaineNum}
                    </td>
                    {sem.jours.map((jour) => {
                      const isSelected = jour.dateKey === selectedKey;
                      const isToday    = jour.dateKey === TODAY_KEY;
                      return (
                        <td
                          key={jour.dateKey}
                          onClick={() => {
                            if (jour.moisCourant) setSelectedKey(isSelected ? null : jour.dateKey);
                          }}
                          className={clsx(
                            'px-1 py-2 align-top transition-colors',
                            jour.moisCourant ? 'cursor-pointer' : 'opacity-25 cursor-default',
                            isSelected ? 'bg-primary-50' : jour.moisCourant ? 'hover:bg-gray-100' : ''
                          )}
                        >
                          <div className="flex flex-col items-center gap-1 min-w-[38px]">
                            {/* Numéro du jour */}
                            <span className={clsx(
                              'w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold',
                              isToday
                                ? 'bg-primary-600 text-white'
                                : jour.estFerie && jour.moisCourant
                                  ? 'bg-orange-100 text-orange-700'
                                  : jour.estWeekend
                                    ? 'text-gray-400'
                                    : 'text-gray-800'
                            )}>
                              {jour.jourNum}
                            </span>

                            {/* Badge heures */}
                            {jour.heuresTotal > 0 && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700 whitespace-nowrap">
                                {formatHeuresQuart(jour.heuresTotal)}
                              </span>
                            )}

                            {/* Indicateurs absences */}
                            {jour.absences.length > 0 && (
                              <div className="flex flex-wrap justify-center gap-0.5">
                                {jour.absences.map((abs, idx) => (
                                  <span
                                    key={idx}
                                    title={abs.label}
                                    className="text-xs px-1 py-0.5 rounded font-medium text-white"
                                    style={{ backgroundColor: abs.color }}
                                  >
                                    {abs.short}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Indicateur férié */}
                            {jour.estFerie && jour.moisCourant && (
                              <span title={jour.ferieNom} className="text-xs font-medium text-orange-500">
                                Férié
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Total semaine */}
                    <td className="px-3 py-3 text-center align-top">
                      {sem.heuresMoisCourant > 0 ? (
                        <span className="text-sm font-bold text-gray-800">
                          {formatHeuresQuart(sem.heuresMoisCourant)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    {/* Statut semaine */}
                    <td className="px-3 py-3 align-top">
                      <StatusBadge status={sem.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Légende */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">7h</span>
            Heures pointées
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-semibold">J</span>
            Aujourd'hui
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-medium text-orange-500">Férié</span>
            Jour férié
          </span>
          {Object.entries(ABSENCE_CONFIG).slice(0, 4).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="px-1 py-0.5 rounded text-white font-medium" style={{ backgroundColor: v.color }}>
                {v.short}
              </span>
              {v.label}
            </span>
          ))}
          <span className="italic text-gray-400">Cliquez sur un jour pour voir le détail</span>
        </div>
      </Card>

      {/* Détail du jour sélectionné */}
      {selectedJour && (
        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {JOURS_NOMS_LONGS[selectedJour.date.getUTCDay()]}{' '}
                {selectedJour.jourNum}{' '}
                {MOIS_LABELS[selectedJour.date.getUTCMonth()]}{' '}
                {selectedJour.date.getUTCFullYear()}
              </h3>
              {selectedJour.estFerie && (
                <p className="text-sm text-orange-600 mt-0.5">Jour férié — {selectedJour.ferieNom}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {selectedJour.heuresTotal > 0 && (
                <span className="text-2xl font-bold text-primary-700">
                  {formatHeuresQuart(selectedJour.heuresTotal)}
                </span>
              )}
              <button
                onClick={() => setSelectedKey(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Absences du jour */}
          {selectedJour.absences.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedJour.absences.map((abs, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: abs.color }}
                >
                  {abs.label}
                </span>
              ))}
            </div>
          )}

          {/* Lignes de pointage */}
          {selectedJour.lignes.length > 0 ? (
            <div className="space-y-2">
              {selectedJour.lignes.map((l, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {l.tacheCouleur && (
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: l.tacheCouleur }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {l.projetCode ? <span className="font-mono text-gray-500">[{l.projetCode}]</span> : ''}{' '}
                        {l.projetNom}
                      </p>
                      {l.tacheNom && (
                        <p className="text-xs text-gray-500 truncate">
                          {l.tacheCode ? `${l.tacheCode} — ` : ''}{l.tacheNom}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="text-sm font-bold text-gray-900">{formatHeuresQuart(l.heures)}</span>
                    <StatusBadge status={l.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">
              {selectedJour.estWeekend ? 'Week-end — aucun pointage' : 'Aucun pointage ce jour'}
            </p>
          )}
        </Card>
      )}

      {/* Répartition par projet */}
      {stats.projets.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            Répartition par projet — {MOIS_LABELS[mois - 1]} {annee}
          </h3>
          <div className="space-y-5">
            {stats.projets.map((proj) => {
              const pct = stats.totalH > 0 ? Math.round((proj.heures / stats.totalH) * 100) : 0;
              return (
                <div key={proj.code || proj.nom}>
                  {/* En-tête projet */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-gray-900">
                      {proj.code && (
                        <span className="font-mono text-gray-500 mr-1">[{proj.code}]</span>
                      )}
                      {proj.nom}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{pct}%</span>
                      <span className="text-sm font-bold text-gray-900">{formatHeuresQuart(proj.heures)}</span>
                    </div>
                  </div>

                  {/* Barre de progression */}
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Détail par tâche */}
                  {proj.tachesListe.length > 1 && (
                    <div className="ml-2 space-y-1">
                      {proj.tachesListe.map((t, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-1.5">
                            {t.couleur && (
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: t.couleur }}
                              />
                            )}
                            <span>{t.code ? `${t.code} — ` : ''}{t.nom || 'Sans tâche'}</span>
                          </div>
                          <span className="font-medium text-gray-700">{formatHeuresQuart(t.heures)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
