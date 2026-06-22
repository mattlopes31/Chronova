import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Send,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Coffee,
  Info,
  Flag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { pointagesApi, projetsApi, congesApi } from '@/services/api';
import { Button, Card, Badge, Select, Spinner, Modal, Input } from '@/components/ui';
import {
  getCurrentWeek,
  getNextWeek,
  getPreviousWeek,
  formatWeekLabel,
  formatHeuresQuart,
  getWeekDays,
  formatDate,
  getDayName,
  getWeeksOfYear,
  getYears,
  getWeekDaysFromApiMonday,
} from '@/utils/dates';
import { computeFeriePourSemaine, dateKeyUTC, dateKeyLocal } from '@/utils/joursFeries';
import type { Projet, SalariePointage, JourFerie, CongeType } from '@/types';

const HEURES_SEMAINE_NORMALE = 35;
const HEURES_CP_PAR_JOUR = 7;

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
const JOURS_OUVRABLES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'] as const;

interface PointageLigne {
  id?: string;
  projet_id: string;
  projet?: Projet;
  tache_projet_id?: string;
  tache_type_id?: string;
  tache_type?: any;
  heures: Record<typeof JOURS[number], number>;
  commentaire?: string;
  isNew?: boolean;
}

// Structure pour gérer les absences par jour avec leur type
interface AbsenceJour {
  actif: boolean;
  type: CongeType;
}

interface CongesState {
  lundi: AbsenceJour;
  mardi: AbsenceJour;
  mercredi: AbsenceJour;
  jeudi: AbsenceJour;
  vendredi: AbsenceJour;
}

export const PointageHebdo = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  // État de la semaine sélectionnée
  const [annee, setAnnee] = useState(getCurrentWeek().year);
  const [semaine, setSemaine] = useState(getCurrentWeek().week);
  
  // État du pointage
  const [lignes, setLignes] = useState<PointageLigne[]>([]);
  // Valeurs texte en cours d'édition (permet "1h30", "1h15", "1,5", etc.)
  const [editingHeures, setEditingHeures] = useState<Record<string, string>>({});
  const [conges, setConges] = useState<CongesState>({
    lundi: { actif: false, type: 'CP' },
    mardi: { actif: false, type: 'CP' },
    mercredi: { actif: false, type: 'CP' },
    jeudi: { actif: false, type: 'CP' },
    vendredi: { actif: false, type: 'CP' },
  });
  
  // État des déplacements (séparé des absences) - inclut week-end
  const [deplacements, setDeplacements] = useState<Record<typeof JOURS[number], boolean>>({
    lundi: false,
    mardi: false,
    mercredi: false,
    jeudi: false,
    vendredi: false,
    samedi: false,
    dimanche: false,
  });

  /** Confirmation explicite « je travaille ce jour férié » (obligatoire avec déplacement pour saisir des heures). */
  const [travailJourFerie, setTravailJourFerie] = useState<Record<typeof JOURS[number], boolean>>({
    lundi: false,
    mardi: false,
    mercredi: false,
    jeudi: false,
    vendredi: false,
    samedi: false,
    dimanche: false,
  });

  const [showFeriesModal, setShowFeriesModal] = useState(false);

  // Modal ajout projet
  const [showAddProjet, setShowAddProjet] = useState(false);
  const [selectedProjetId, setSelectedProjetId] = useState('');
  // On sélectionne d'abord la tâche "par projet" (tache_projet_id),
  // même si tache_type_id est NULL (le backend résout ensuite).
  const [selectedTacheProjetId, setSelectedTacheProjetId] = useState('');

  // Jours affichés (local) — recalés sur `dates.lundi` de l’API quand elle arrive (même grille que le serveur / fériés).
  const joursSemaineLocale = useMemo(() => {
    try {
      if (!annee || !semaine) return [];
      return getWeekDays(annee, semaine);
    } catch (e) {
      console.error('Erreur getWeekDays:', e);
      return [];
    }
  }, [annee, semaine]);

  // Queries - Récupérer les projets assignés au salarié
  const { data: mesProjets = [], isLoading: projetsLoading } = useQuery({
    queryKey: ['mes-projets', user?.id],
    queryFn: () => projetsApi.getMesProjets(),
    refetchInterval: 60000, // Rafraîchir toutes les 1 minute (60000 ms)
    staleTime: 0, // Considérer les données comme obsolètes immédiatement
    refetchOnWindowFocus: true, // Rafraîchir quand la fenêtre reprend le focus
  });

  // Liste des projets assignés avec leurs tâches
  const projetsDisponibles = useMemo(() => {
    return mesProjets.map((p: any) => ({
      ...p,
      tachesAssignees: p.affectations
        ?.filter((a: any) => a.salarie_id === user?.id)
        .map((a: any) => a.tache_projet) || [],
    }));
  }, [mesProjets, user?.id]);

  // Index rapide: (projet_id + tache_type_id) -> { label, couleur }
  const tacheIndex = useMemo(() => {
    const map = new Map<string, { label: string; couleur: string }>();
    projetsDisponibles.forEach((p: any) => {
      const projetId = String(p.id);
      (p.affectations || [])
        .filter((a: any) => String(a.salarie_id) === String(user?.id))
        .forEach((a: any) => {
          // IMPORTANT:
          // `tache_projet_salarie.tache_type_id` peut être NULL (notamment si non fourni à l'API),
          // mais `tache_projet.tache_type_id` contient souvent le vrai type.
          const derivedTypeId =
            a.tache_type_id != null
              ? String(a.tache_type_id)
              : (a.tache_projet?.tache_type_id != null ? String(a.tache_projet.tache_type_id) : '');
          const typeId = derivedTypeId;
          if (!typeId) return;

          const code =
            a.tache_projet?.code ||
            a.tache_projet?.tache_type?.code ||
            a.tache_type?.code ||
            '';
          const nom =
            a.tache_projet?.nom_tache ||
            a.tache_projet?.tache_type?.tache_type ||
            a.tache_type?.tache_type ||
            'Tâche';
          const couleur =
            a.tache_projet?.couleur ||
            a.tache_projet?.tache_type?.couleur ||
            a.tache_type?.couleur ||
            '#3B82F6';

          const label = code ? `${code} - ${nom}` : nom;
          map.set(`${projetId}:${typeId}`, { label, couleur });
        });
    });
    return map;
  }, [projetsDisponibles, user?.id]);

  const { data: semaineData, isLoading: semaineLoading, refetch } = useQuery({
    queryKey: ['pointage-semaine', annee, semaine],
    queryFn: () => pointagesApi.getSemaine(annee, semaine),
    refetchInterval: 60000, // Rafraîchir toutes les 1 minute (60000 ms)
  });

  const lundiApi = (semaineData as { dates?: { lundi?: string } } | undefined)?.dates?.lundi;

  const joursSemaine = useMemo(() => {
    if (lundiApi && typeof lundiApi === 'string') {
      const fromApi = getWeekDaysFromApiMonday(lundiApi);
      if (fromApi.length === 7) return fromApi;
    }
    return joursSemaineLocale;
  }, [lundiApi, joursSemaineLocale]);

  const dayKeyForPointage = useMemo(
    () => (lundiApi ? dateKeyUTC : dateKeyLocal),
    [lundiApi]
  );

  const yearsForFeries = useMemo(() => {
    const ys = new Set<number>();
    ys.add(annee);
    if (!joursSemaine.length) return [...ys].sort((a, b) => a - b);
    const useUtc = Boolean(lundiApi);
    joursSemaine.forEach((d) => {
      ys.add(useUtc ? d.getUTCFullYear() : d.getFullYear());
    });
    return [...ys].sort((a, b) => a - b);
  }, [annee, lundiApi, joursSemaine]);

  const yearsFeriesKey = yearsForFeries.join(',');

  const { data: joursFeries = [] } = useQuery({
    queryKey: ['jours-feries', yearsFeriesKey],
    queryFn: async () => {
      const lists = await Promise.all(yearsForFeries.map((y) => congesApi.getJoursFeries(y)));
      return lists.flat();
    },
    enabled: yearsForFeries.length > 0,
  });

  const joursFeriesMerged = useMemo(() => {
    const map = new Map<string, JourFerie>();
    const push = (arr: any[] | undefined) => {
      (arr || []).forEach((j: any) => {
        const dk = String(j?.date ?? '').split('T')[0];
        if (!dk) return;
        if (!map.has(dk)) {
          map.set(dk, {
            id: String(j.id),
            date: dk,
            libelle: j.libelle ?? j.nom ?? '',
            nom: j.nom,
          });
        }
      });
    };
    push((semaineData as any)?.jours_feries);
    push(joursFeries as any);
    return [...map.values()];
  }, [joursFeries, semaineData?.jours_feries]);

  const feriesSemaine = useMemo(() => {
    if (!joursSemaine.length || !joursFeriesMerged.length) return [];
    const keys = joursSemaine.map((d) => dayKeyForPointage(d));
    return joursFeriesMerged.filter((jf) => keys.includes(String(jf.date).split('T')[0]));
  }, [joursSemaine, joursFeriesMerged, dayKeyForPointage]);

  // Initialiser les lignes avec les données existantes
  useEffect(() => {
    console.log('=== useEffect semaineData ===');
    console.log('semaineData:', semaineData);

    // Important: lors d'un refetch (invalidateQueries), `semaineData` peut être transitoirement `undefined`.
    // Ne pas réinitialiser l'UI (sinon les cases week-end "sautent" au clic sur Enregistrer).
    if (!semaineData) return;
    
    if (semaineData?.pointages) {
      console.log('Pointages reçus:', semaineData.pointages);
      
      const lignesExistantes: PointageLigne[] = semaineData.pointages.map((p: any) => {
        // Fonction helper pour convertir en nombre
        const toNumber = (val: any): number => {
          if (val === null || val === undefined || val === '') return 0;
          const num = Number(val);
          return isNaN(num) ? 0 : num;
        };

        const projetIdStr = p.projet_id?.toString();
        const typeIdStr = p.tache_type_id?.toString() || p.tache_type?.id?.toString();
        const fallbackTache = (projetIdStr && typeIdStr)
          ? tacheIndex.get(`${projetIdStr}:${typeIdStr}`)
          : null;

        const ligne = {
          id: p.id,
          projet_id: projetIdStr,
          projet: p.projet,
          tache_projet_id: p.tache_projet_id,
          tache_type_id: typeIdStr,
          // Si l'API ne renvoie pas l'objet tâche, on reconstruit un objet minimal pour l'affichage
          tache_type: p.tache_type || (fallbackTache ? { tache_type: fallbackTache.label, couleur: fallbackTache.couleur } : null),
          heures: {
            lundi: toNumber(p.heure_lundi),
            mardi: toNumber(p.heure_mardi),
            mercredi: toNumber(p.heure_mercredi),
            jeudi: toNumber(p.heure_jeudi),
            vendredi: toNumber(p.heure_vendredi),
            samedi: toNumber(p.heure_samedi),
            dimanche: toNumber(p.heure_dimanche),
          },
          commentaire: p.commentaire,
        };
        console.log('Ligne créée depuis serveur:', ligne);
        return ligne;
      });
      setLignes(lignesExistantes);
    } else {
      setLignes([]);
    }

    if (semaineData.conges) {
      const typeConge = semaineData.conges.type_conge || 'CP';
      
      // Séparer les déplacements des autres absences
      const nouveauxConges: CongesState = {
        lundi: { actif: false, type: 'CP' },
        mardi: { actif: false, type: 'CP' },
        mercredi: { actif: false, type: 'CP' },
        jeudi: { actif: false, type: 'CP' },
        vendredi: { actif: false, type: 'CP' },
      };
      
      const nouveauxDeplacements: Record<typeof JOURS[number], boolean> = {
        lundi: false,
        mardi: false,
        mercredi: false,
        jeudi: false,
        vendredi: false,
        samedi: false,
        dimanche: false,
      };
      
      // Pour chaque jour, vérifier si c'est un déplacement ou une autre absence
      JOURS_OUVRABLES.forEach((jour) => {
        const cpKey = `cp_${jour}` as keyof typeof semaineData.conges;
        const typeKey = `type_${jour}` as keyof typeof semaineData.conges;
        const isActif = semaineData.conges[cpKey] || false;
        const type = (semaineData.conges[typeKey] || typeConge) as CongeType;
        
        if (isActif && type === 'Deplacement') {
          nouveauxDeplacements[jour] = true;
        } else if (isActif) {
          nouveauxConges[jour] = { actif: true, type: type };
        }
      });

      (['samedi', 'dimanche'] as const).forEach((jour) => {
        const cpKey = `cp_${jour}` as keyof typeof semaineData.conges;
        const typeKey = `type_${jour}` as keyof typeof semaineData.conges;
        const isActif = Boolean(semaineData.conges[cpKey]);
        const type = (semaineData.conges[typeKey] || typeConge) as CongeType;
        // Fallback: si le backend ne renvoie pas encore `type_samedi/type_dimanche`,
        // un congé de type global "Deplacement" doit quand même cocher le week-end.
        if (isActif && (type === 'Deplacement' || typeConge === 'Deplacement')) {
          nouveauxDeplacements[jour] = true;
        }
      });
      
      setConges(nouveauxConges);
      setDeplacements(nouveauxDeplacements);

      const nt: Record<typeof JOURS[number], boolean> = {
        lundi: false,
        mardi: false,
        mercredi: false,
        jeudi: false,
        vendredi: false,
        samedi: false,
        dimanche: false,
      };
      JOURS.forEach((jour) => {
        const k = `travail_ferie_${jour}` as keyof typeof semaineData.conges;
        if ((semaineData.conges as any)[k] === true) {
          nt[jour] = true;
        }
      });
      setTravailJourFerie(nt);
    } else {
      setConges({
        lundi: { actif: false, type: 'CP' },
        mardi: { actif: false, type: 'CP' },
        mercredi: { actif: false, type: 'CP' },
        jeudi: { actif: false, type: 'CP' },
        vendredi: { actif: false, type: 'CP' },
      });
      setDeplacements({
        lundi: false,
        mardi: false,
        mercredi: false,
        jeudi: false,
        vendredi: false,
        samedi: false,
        dimanche: false,
      });
      setTravailJourFerie({
        lundi: false,
        mardi: false,
        mercredi: false,
        jeudi: false,
        vendredi: false,
        samedi: false,
        dimanche: false,
      });
    }
  }, [semaineData]);

  /** Persiste les pointages + congés/déplacements (utilisé par Enregistrer et avant Soumettre). */
  const persistPointageWeek = useCallback(async () => {
    console.log('=== Début sauvegarde ===');
    console.log('Lignes à sauvegarder:', JSON.stringify(lignes, null, 2));

    const getTypeJour = (jour: typeof JOURS_OUVRABLES[number]) => {
      if (deplacements[jour]) return 'Deplacement';
      return conges[jour].type;
    };

    const getActifJour = (jour: typeof JOURS_OUVRABLES[number]) => {
      return conges[jour].actif || deplacements[jour];
    };

    const travail_ferie = JOURS.reduce(
      (acc, jour) => {
        acc[jour] = !!travailJourFerie[jour];
        return acc;
      },
      {} as Record<(typeof JOURS)[number], boolean>
    );

    // Congés d’abord : le serveur valide les pointages avec le motif « travail férié » déjà en base.
    await congesApi.create({
      annee,
      semaine,
      cp_lundi: getActifJour('lundi'),
      cp_mardi: getActifJour('mardi'),
      cp_mercredi: getActifJour('mercredi'),
      cp_jeudi: getActifJour('jeudi'),
      cp_vendredi: getActifJour('vendredi'),
      cp_samedi: deplacements.samedi,
      cp_dimanche: deplacements.dimanche,
      type_lundi: getTypeJour('lundi'),
      type_mardi: getTypeJour('mardi'),
      type_mercredi: getTypeJour('mercredi'),
      type_jeudi: getTypeJour('jeudi'),
      type_vendredi: getTypeJour('vendredi'),
      type_samedi: deplacements.samedi ? 'Deplacement' : 'CP',
      type_dimanche: deplacements.dimanche ? 'Deplacement' : 'CP',
      type_conge: getActifJour('lundi')
        ? getTypeJour('lundi')
        : getActifJour('mardi')
          ? getTypeJour('mardi')
          : getActifJour('mercredi')
            ? getTypeJour('mercredi')
            : getActifJour('jeudi')
              ? getTypeJour('jeudi')
              : getActifJour('vendredi')
                ? getTypeJour('vendredi')
                : deplacements.samedi || deplacements.dimanche
                  ? 'Deplacement'
                  : 'CP',
      travail_ferie,
    });

    for (const ligne of lignes) {
      if (ligne.projet_id && (ligne.tache_type_id || ligne.tache_projet_id)) {
        const toNumber = (val: any): number => {
          if (val === null || val === undefined || val === '') return 0;
          const num = Number(val);
          return isNaN(num) ? 0 : num;
        };

        const dataToSend: any = {
          projet_id: ligne.projet_id,
          tache_type_id: ligne.tache_type_id || undefined,
          tache_projet_id: ligne.tache_projet_id || undefined,
          annee,
          semaine,
          heure_lundi: toNumber(ligne.heures.lundi),
          heure_mardi: toNumber(ligne.heures.mardi),
          heure_mercredi: toNumber(ligne.heures.mercredi),
          heure_jeudi: toNumber(ligne.heures.jeudi),
          heure_vendredi: toNumber(ligne.heures.vendredi),
          heure_samedi: toNumber(ligne.heures.samedi),
          heure_dimanche: toNumber(ligne.heures.dimanche),
          commentaire: ligne.commentaire,
        };

        await pointagesApi.create(dataToSend);
      } else {
        console.warn('Ligne sans tache_type_id ni tache_projet_id ignorée:', ligne);
      }
    }
  }, [lignes, conges, deplacements, annee, semaine, travailJourFerie]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: persistPointageWeek,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pointage-semaine'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pointages'] });
      toast.success('Pointage enregistré');
    },
    onError: (error: any) => {
      console.error('Erreur sauvegarde:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await persistPointageWeek();
      await pointagesApi.soumettre(annee, semaine);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pointage-semaine'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pointages'] });
      toast.success('Pointage enregistré et soumis pour validation');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la soumission');
    },
  });

  // Navigation semaine
  const goToPreviousWeek = () => {
    const prev = getPreviousWeek(annee, semaine);
    setAnnee(prev.year);
    setSemaine(prev.week);
  };

  const goToNextWeek = () => {
    const next = getNextWeek(annee, semaine);
    setAnnee(next.year);
    setSemaine(next.week);
  };

  const goToCurrentWeek = () => {
    const current = getCurrentWeek();
    setAnnee(current.year);
    setSemaine(current.week);
  };

  // Gestion des lignes
  const addLigne = () => {
    if (!selectedProjetId) {
      toast.error('Sélectionnez un projet');
      return;
    }
    
    if (!selectedTacheProjetId) {
      toast.error('Sélectionnez une tâche');
      return;
    }
    
    const projet = projetsDisponibles.find((p: any) => p.id?.toString() === selectedProjetId);
    
    if (!projet) {
      toast.error('Projet non trouvé');
      return;
    }
    
    const affectation = projet.affectations?.find((a: any) =>
      a.tache_projet_id?.toString() === selectedTacheProjetId
    );
    
    console.log('Ajout ligne avec tâche:', { projet, selectedTacheProjetId, affectation });
    
    // Déterminer l'objet tache_type à utiliser
    let tacheTypeObj = null;
    if (affectation?.tache_projet?.nom_tache) {
      // Tâche personnalisée avec nom_tache - créer un objet avec les infos nécessaires
      tacheTypeObj = {
        tache_type: affectation.tache_projet.nom_tache,
        code: affectation.tache_projet.code || affectation.tache_projet.tache_type?.code,
        couleur: affectation.tache_projet.couleur || affectation.tache_projet.tache_type?.couleur || '#3B82F6'
      };
    } else if (affectation?.tache_projet?.tache_type) {
      // Tâche personnalisée avec tache_type
      tacheTypeObj = affectation.tache_projet.tache_type;
    } else if (affectation?.tache_type) {
      // Tâche globale
      tacheTypeObj = affectation.tache_type;
    }
    
    setLignes([...lignes, {
      projet_id: selectedProjetId,
      projet,
      tache_projet_id: selectedTacheProjetId,
      tache_type_id: affectation?.tache_type_id?.toString() || affectation?.tache_projet?.tache_type_id?.toString() || undefined,
      tache_type: tacheTypeObj,
      heures: { lundi: 0, mardi: 0, mercredi: 0, jeudi: 0, vendredi: 0, samedi: 0, dimanche: 0 },
      isNew: true,
    }]);
    setShowAddProjet(false);
    setSelectedProjetId('');
    setSelectedTacheProjetId('');
  };

  const removeLigne = (index: number) => {
    const newLignes = [...lignes];
    newLignes.splice(index, 1);
    setLignes(newLignes);
  };

  const updateHeures = (index: number, jour: typeof JOURS[number], value: number) => {
    const newLignes = [...lignes];
    const numValue = Number(value);
    const finalValue = isNaN(numValue) ? 0 : Math.max(0, Math.min(24, numValue));
    newLignes[index].heures[jour] = finalValue;
    console.log(`Update heures ligne ${index}, jour ${jour}: ${value} -> ${finalValue}`);
    setLignes(newLignes);
  };

  const roundToQuarter = (hours: number) => Math.round(hours * 4) / 4;

  const formatForInput = (hours: number) => {
    if (!hours) return '';
    const rounded = roundToQuarter(hours);
    const h = Math.floor(rounded);
    const m = Math.round((rounded - h) * 60);
    if (!m) return String(h);
    return `${h}h${String(m).padStart(2, '0')}`;
  };

  // Parse "1h30" / "1h15" / "1,5" / "1.25" / "90min"
  const parseHeuresInput = (raw: string): number | null => {
    const s = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(',', '.')
      .replace(/\s+/g, '');
    if (!s) return 0;

    // 90min
    const minMatch = s.match(/^(\d+(?:\.\d+)?)min$/);
    if (minMatch) {
      const mins = parseFloat(minMatch[1]);
      if (!isFinite(mins)) return null;
      return roundToQuarter(mins / 60);
    }

    // 1h30 / 1h / 1h5 (-> 1h05)
    const hMatch = s.match(/^(\d+)(?:h(\d{1,2}))?$/);
    if (hMatch) {
      const h = parseInt(hMatch[1], 10);
      const m = hMatch[2] ? parseInt(hMatch[2], 10) : 0;
      if (!isFinite(h) || !isFinite(m)) return null;
      return roundToQuarter(h + m / 60);
    }

    // 1.5 / 1.25
    const n = parseFloat(s);
    if (!isFinite(n)) return null;
    return roundToQuarter(n);
  };

  const toggleConge = (jour: typeof JOURS_OUVRABLES[number], type: CongeType = 'CP') => {
    const heuresJour = lignes.reduce((sum, l) => sum + (Number(l.heures[jour]) || 0), 0);
    const jourData = conges[jour];
    
    if (heuresJour > 0 && !jourData.actif) {
      toast.error('Supprimez d\'abord les heures pointées ce jour');
      return;
    }
    
    setConges({ 
      ...conges, 
      [jour]: { 
        actif: !jourData.actif, 
        type: type 
      } 
    });
  };

  const setTypeConge = (jour: typeof JOURS_OUVRABLES[number], type: CongeType) => {
    const jourData = conges[jour];
    setConges({ 
      ...conges, 
      [jour]: { 
        ...jourData, 
        type: type 
      } 
    });
  };

  // Toggle déplacement (séparé des absences) - autorisé aussi le week-end
  const toggleDeplacement = (jour: typeof JOURS[number]) => {
    const heuresJour = lignes.reduce((sum, l) => sum + (Number(l.heures[jour]) || 0), 0);
    if (deplacements[jour] && heuresJour > 0) {
      toast.error('Supprimez d’abord les heures pointées ce jour avant de retirer le déplacement');
      return;
    }

    // Si on active le déplacement un jour ouvrable, on désactive l'absence pour ce jour
    if (JOURS_OUVRABLES.includes(jour as any) && !deplacements[jour] && conges[jour as keyof CongesState].actif) {
      setConges({
        ...conges,
        [jour]: { actif: false, type: 'CP' }
      });
    }

    setDeplacements((prev) => {
      if (prev[jour]) {
        setTravailJourFerie((tf) => ({ ...tf, [jour]: false }));
      }
      return { ...prev, [jour]: !prev[jour] };
    });
  };

  const toggleTravailJourFerie = (jour: typeof JOURS[number], jourIndex: number) => {
    const heuresJour = lignes.reduce((sum, l) => sum + (Number(l.heures[jour]) || 0), 0);
    if (travailJourFerie[jour] && heuresJour > 0) {
      toast.error('Supprimez d’abord les heures pointées ce jour avant de retirer « Travail ce jour férié »');
      return;
    }
    const willEnable = !travailJourFerie[jour];
    const jf = joursFeriesMerged.find(
      (x) => String(x.date).split('T')[0] === dayKeyForPointage(joursSemaine[jourIndex])
    );
    setTravailJourFerie((tf) => ({ ...tf, [jour]: !tf[jour] }));
    if (willEnable && jf && !deplacements[jour]) {
      toast('Cochez aussi « Déplacement » ce même jour pour pouvoir saisir des heures.', { duration: 4000 });
    }
  };

  // Calculs
  const calculs = useMemo(() => {
    const heuresParJour = JOURS.reduce((acc, jour) => {
      acc[jour] = lignes.reduce((sum, l) => sum + (Number(l.heures[jour]) || 0), 0);
      return acc;
    }, {} as Record<string, number>);

    const heuresTravaillees = Object.values(heuresParJour).reduce((sum, h) => sum + Number(h), 0);

    const ferieBloc = computeFeriePourSemaine(
      joursSemaine,
      heuresParJour,
      joursFeriesMerged,
      HEURES_CP_PAR_JOUR,
      dayKeyForPointage
    );
    const { nbFeries, creditFerie, heuresTravailJoursFeries, heuresTravailSansFerie } = ferieBloc;

    const joursCP = JOURS_OUVRABLES.filter((j) => {
      const jourData = conges[j];
      return jourData.actif && (jourData.type === 'CP' || jourData.type === 'RTT');
    }).length;
    const heuresCP = joursCP * HEURES_CP_PAR_JOUR;

    const joursMaladie = JOURS_OUVRABLES.filter((j) => {
      const jourData = conges[j];
      return jourData.actif && jourData.type === 'Maladie';
    }).length;
    const heuresMaladie = joursMaladie * HEURES_CP_PAR_JOUR;

    const joursDeplacement = JOURS_OUVRABLES.filter((j) => deplacements[j]).length;
    const heuresDeplacement = 0;

    // Objectif semaine : travail hors jours fériés + crédit 7h par férié non travaillé + CP
    const totalSemaine = heuresTravailSansFerie + heuresCP + creditFerie;

    const heuresNormalesRequises =
      HEURES_SEMAINE_NORMALE - HEURES_CP_PAR_JOUR * nbFeries;

    const heuresDuesSemaine = Math.max(0, heuresNormalesRequises - totalSemaine);

    const heuresDues = heuresDuesSemaine + heuresMaladie;

    const heuresNormales = Math.min(totalSemaine, heuresNormalesRequises);

    const heuresEnPlus = Math.max(0, totalSemaine - heuresNormalesRequises);
    const heuresSup = heuresEnPlus + heuresTravailJoursFeries;

    return {
      heuresParJour,
      heuresTravaillees,
      nbFeries,
      creditFerie,
      heuresTravailJoursFeries,
      joursCP,
      heuresCP,
      joursMaladie,
      heuresMaladie,
      joursDeplacement,
      heuresDeplacement,
      totalSemaine,
      heuresNormales,
      heuresSup,
      heuresDues,
      heuresDuesSemaine,
      heuresNormalesRequises,
    };
  }, [lignes, conges, deplacements, semaineData, joursSemaine, joursFeriesMerged, dayKeyForPointage]);

  // Status de la semaine
  const validationStatus = semaineData?.validation?.status || 'Brouillon';
  // Semaine soumise ou validée : plus de modification (comme une semaine validée).
  const isLocked = validationStatus === 'Valide' || validationStatus === 'Soumis';

  const getTacheDisplayForLigne = (ligne: PointageLigne): { label: string; couleur: string } => {
    const projetId = String(ligne.projet_id || '');
    const typeId = String(ligne.tache_type_id || '');
    const fromIndex = (projetId && typeId) ? tacheIndex.get(`${projetId}:${typeId}`) : undefined;
    if (fromIndex) return fromIndex;

    const tache = ligne.tache_type;
    if (!tache) return { label: 'Tâche', couleur: '#3B82F6' };
    if (typeof tache === 'string') return { label: tache, couleur: '#3B82F6' };

    const code = tache.code || tache.tache_type?.code;
    const nom = tache.tache_type || tache.nom_tache || tache.tache_type?.tache_type || 'Tâche';
    const couleur = tache.couleur || tache.tache_type?.couleur || '#3B82F6';
    return { label: code ? `${code} - ${nom}` : nom, couleur };
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    Brouillon: { label: 'Brouillon', color: 'gray' },
    Soumis: { label: 'En attente de validation', color: 'yellow' },
    Valide: { label: 'Validé', color: 'green' },
    Rejete: { label: 'Rejeté', color: 'red' },
  };

  if (semaineLoading || projetsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="py-4" />
      </div>
    );
  }

  // Vérifier que les jours de la semaine sont disponibles
  if (joursSemaine.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="py-4" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pointage hebdomadaire</h1>
          <p className="text-gray-600">Saisissez vos heures par projet</p>
        </div>
        <Badge variant={statusConfig[validationStatus]?.color as any}>
          {statusConfig[validationStatus]?.label}
        </Badge>
      </div>

      {/* Navigation semaine */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2">
              <Select
                value={semaine.toString()}
                onChange={(e) => setSemaine(parseInt(e.target.value))}
                options={getWeeksOfYear(annee).map(w => ({
                  value: w.value.toString(),
                  label: w.label,
                }))}
                className="w-32"
              />
              <Select
                value={annee.toString()}
                onChange={(e) => setAnnee(parseInt(e.target.value))}
                options={getYears().map(y => ({
                  value: y.value.toString(),
                  label: y.label,
                }))}
                className="w-24"
              />
            </div>

            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center text-sm text-gray-600">
            {formatWeekLabel(annee, semaine)}
          </div>

          <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
            <Calendar className="w-4 h-4" />
            Semaine actuelle
          </Button>
        </div>
      </Card>

      {/* Tableau de pointage */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">
                  Projet / Tâche
                </th>
                {JOURS.map((jour, index) => {
                  const date = joursSemaine[index];
                  const jourFerie = joursFeriesMerged.find(
                    (jf: JourFerie) => String(jf.date).split('T')[0] === dayKeyForPointage(date)
                  );
                  const isWeekend = index >= 5;
                  const jourData = JOURS_OUVRABLES.includes(jour as any) 
                    ? conges[jour as keyof CongesState]
                    : null;
                  const isAbsent = jourData?.actif || false;
                  const absenceType = jourData?.type;

                  return (
                    <th 
                      key={jour} 
                      className={clsx(
                        'px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider w-20',
                        isWeekend ? 'bg-gray-100 text-gray-400' : '',
                        jourFerie ? 'bg-red-50 text-red-600' : '',
                        isAbsent && absenceType === 'Maladie' ? 'bg-blue-50 text-blue-600' : '',
                        isAbsent && absenceType === 'Deplacement' ? 'bg-purple-50 text-purple-600' : '',
                        isAbsent && absenceType !== 'Maladie' && absenceType !== 'Deplacement' ? 'bg-amber-50 text-amber-600' : '',
                        !isWeekend && !jourFerie && !isAbsent ? 'text-gray-600' : ''
                      )}
                    >
                      <div>{getDayName(index)}</div>
                      <div className="text-[10px] font-normal">
                        {formatDate(date, 'dd/MM')}
                      </div>
                      {jourFerie && (
                        <div className="text-[9px] font-normal truncate" title={jourFerie.libelle}>
                          {jourFerie.libelle}
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                  Total
                </th>
                <th className="px-2 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* Ligne Absences (CP, Maladie, Sans solde) */}
              <tr className="bg-gradient-to-r from-amber-50/50 to-blue-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-gray-700">Absences</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1 text-xs">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded">CP</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Maladie</span>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">Sans solde</span>
                  </div>
                </td>
                {JOURS.map((jour, index) => {
                  const isOuvrable = JOURS_OUVRABLES.includes(jour as any);
                  const jourData = isOuvrable ? conges[jour as keyof CongesState] : null;
                  const isChecked = jourData?.actif || false;
                  const typeConge = jourData?.type || 'CP';
                  const isDeplacement = isOuvrable && deplacements[jour as keyof typeof deplacements];
                  
                  // Couleur selon le type
                  const getTypeColor = (type: string) => {
                    switch(type) {
                      case 'Maladie': return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', checkbox: 'text-blue-600 focus:ring-blue-500' };
                      case 'Sans_solde': return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', checkbox: 'text-gray-600 focus:ring-gray-500' };
                      default: return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', checkbox: 'text-amber-600 focus:ring-amber-500' };
                    }
                  };
                  const colors = getTypeColor(typeConge);
                  
                  return (
                    <td key={jour} className="px-2 py-3 text-center">
                      {isOuvrable ? (
                        <div className="flex flex-col items-center gap-1">
                          <label className="flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                // Si déplacement actif, on le désactive
                                if (isDeplacement) {
                                  setDeplacements({ ...deplacements, [jour]: false });
                                }
                                toggleConge(jour as typeof JOURS_OUVRABLES[number], typeConge);
                              }}
                              disabled={isLocked}
                              className={clsx(
                                'w-5 h-5 rounded focus:ring-2',
                                colors.border,
                                colors.checkbox
                              )}
                            />
                          </label>
                          {isChecked && (
                            <select
                              value={typeConge}
                              onChange={(e) => setTypeConge(jour as typeof JOURS_OUVRABLES[number], e.target.value as CongeType)}
                              disabled={isLocked}
                              className={clsx(
                                'text-[10px] px-1 py-0.5 rounded border-0 font-medium',
                                colors.bg,
                                colors.text
                              )}
                            >
                              <option value="CP">CP</option>
                              <option value="Maladie">Maladie</option>
                              <option value="Sans_solde">Sans solde</option>
                            </select>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col gap-1">
                    {calculs.heuresCP > 0 && (
                      <span className="text-amber-700 font-semibold text-xs">{calculs.heuresCP}h CP</span>
                    )}
                    {calculs.heuresMaladie > 0 && (
                      <span className="text-blue-700 font-semibold text-xs">{calculs.heuresMaladie}h Mal.</span>
                    )}
                    {calculs.heuresCP === 0 && calculs.heuresMaladie === 0 && (
                      <span className="text-gray-400">0h</span>
                    )}
                  </div>
                </td>
                <td></td>
              </tr>

              <tr className="bg-red-50/50 border-b border-red-100">
                <td className="px-4 py-2" colSpan={10}>
                  <div className="flex flex-wrap items-center gap-3 justify-between">
                    <p className="text-xs text-gray-700 max-w-3xl">
                      Tous les jours fériés définis dans Chronova s’appliquent automatiquement. Pour saisir des heures un
                      jour férié, cochez <strong>Travail ce jour férié</strong> puis <strong>Déplacement</strong> pour le
                      même jour (les deux sont obligatoires).
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFeriesModal(true)}
                      disabled={feriesSemaine.length === 0}
                      className="shrink-0 border-red-200 text-red-800 hover:bg-red-50"
                    >
                      <Info className="w-4 h-4 mr-1" />
                      Voir les jours fériés ({feriesSemaine.length})
                    </Button>
                  </div>
                </td>
              </tr>

              <tr className="bg-gradient-to-r from-red-50/90 to-rose-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-red-600" />
                    <span className="font-medium text-gray-800">Travail ce jour férié</span>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1 leading-snug">
                    Cases affichées uniquement sur les jours fériés. À combiner avec la ligne Déplacement ci-dessous.
                  </p>
                </td>
                {JOURS.map((jour, idx) => {
                  const date = joursSemaine[idx];
                  const jourFerieRow = joursFeriesMerged.find(
                    (jf: JourFerie) => String(jf.date).split('T')[0] === dayKeyForPointage(date)
                  );
                  return (
                    <td key={jour} className="px-2 py-3 text-center align-middle">
                      {jourFerieRow ? (
                        <label className="inline-flex flex-col items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!travailJourFerie[jour]}
                            onChange={() => toggleTravailJourFerie(jour, idx)}
                            disabled={isLocked}
                            className="w-5 h-5 rounded border-red-300 text-red-600 focus:ring-red-500"
                          />
                        </label>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center text-gray-400 text-xs">—</td>
                <td></td>
              </tr>

              {/* Ligne Déplacements (séparée) */}
              <tr className="bg-gradient-to-r from-purple-50/50 to-violet-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-gray-700">Déplacements</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1 text-xs">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">Journée en déplacement</span>
                    <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded">
                      Sur un férié : cocher aussi la ligne « Travail ce jour férié »
                    </span>
                  </div>
                </td>
                {JOURS.map((jour) => {
                  const isOuvrable = JOURS_OUVRABLES.includes(jour as any);
                  const isChecked = !!deplacements[jour as keyof typeof deplacements];
                  const hasAbsence = isOuvrable && conges[jour as keyof CongesState]?.actif;
                  
                  return (
                    <td key={jour} className="px-2 py-3 text-center">
                      {/* Déplacements autorisés aussi le week-end */}
                      {true ? (
                        <div className="flex flex-col items-center gap-1">
                          <label className="flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                // Si absence active, on la désactive
                                if (hasAbsence) {
                                  setConges({ ...conges, [jour]: { actif: false, type: 'CP' } });
                                }
                                toggleDeplacement(jour as typeof JOURS[number]);
                              }}
                              disabled={isLocked}
                              className="w-5 h-5 rounded focus:ring-2 border-purple-300 text-purple-600 focus:ring-purple-500"
                            />
                          </label>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center">
                  {/* Les heures de déplacement sont maintenant saisies manuellement dans les lignes de pointage */}
                  {/* On affiche le total des heures pointées pour les jours en déplacement */}
                  {(() => {
                    const heuresDeplacementManuelles = JOURS.reduce((sum, jour) => {
                      if (deplacements[jour]) {
                        return sum + (calculs.heuresParJour[jour] || 0);
                      }
                      return sum;
                    }, 0);
                    return heuresDeplacementManuelles > 0 ? (
                      <span className="text-purple-700 font-semibold text-xs">{formatHeuresQuart(heuresDeplacementManuelles)}</span>
                    ) : (
                      <span className="text-gray-400">0h</span>
                    );
                  })()}
                </td>
                <td></td>
              </tr>

              {/* Lignes de pointage */}
              {lignes
                .map((ligne, originalIndex) => ({
                  ligne,
                  originalIndex,
                  key:
                    (ligne.id ? `p-${ligne.id}` : null) ||
                    `p-${String(ligne.projet_id)}-${String(ligne.tache_projet_id || '')}-${String(ligne.tache_type_id || '')}`,
                }))
                .sort((a, b) => {
                  const codeA = (a.ligne.projet?.code_projet || '').toString();
                  const codeB = (b.ligne.projet?.code_projet || '').toString();
                  return codeA.localeCompare(codeB, 'fr', { numeric: true, sensitivity: 'base' });
                })
                .map(({ ligne, originalIndex, key }) => {
                  const tacheDisplay = getTacheDisplayForLigne(ligne);
                  return (
                <tr key={key} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {ligne.projet?.nom || 'Projet inconnu'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{ligne.projet?.code_projet}</span>
                      {tacheDisplay.label && tacheDisplay.label !== 'Tâche' && (
                        <span 
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${tacheDisplay.couleur}20`,
                            color: tacheDisplay.couleur
                          }}
                        >
                          {tacheDisplay.label}
                        </span>
                      )}
                    </div>
                  </td>
                  {JOURS.map((jour, jourIndex) => {
                    const isWeekend = jourIndex >= 5;
                    const jourData = JOURS_OUVRABLES.includes(jour as any) 
                      ? conges[jour as keyof CongesState]
                      : null;
                    const isAbsent = jourData?.actif || false;
                    const absenceType = jourData?.type;
                    const isDeplacement = !!deplacements[jour as keyof typeof deplacements];
                    const jourFerie = joursFeriesMerged.find(
                      (jf: JourFerie) =>
                        String(jf.date).split('T')[0] === dayKeyForPointage(joursSemaine[jourIndex])
                    );

                    // Jour férié : les deux cases « Travail ce jour férié » + « Déplacement » sont obligatoires
                    const travailFerieOk = !!travailJourFerie[jour as keyof typeof travailJourFerie];
                    const cannotEdit =
                      isAbsent || (!!jourFerie && !(travailFerieOk && isDeplacement));
                    
                    return (
                      <td key={jour} className={clsx(
                        'px-2 py-3 text-center',
                        isWeekend && 'bg-gray-50',
                        isAbsent && absenceType === 'Maladie' && 'bg-blue-50',
                        isDeplacement && 'bg-purple-50',
                        isAbsent && absenceType !== 'Maladie' && 'bg-amber-50',
                        jourFerie && 'bg-red-50'
                      )}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editingHeures[`${key}:${jour}`] ?? formatForInput(Number(ligne.heures[jour] || 0))}
                          onFocus={() => {
                            const k = `${key}:${jour}`;
                            setEditingHeures((prev) => ({
                              ...prev,
                              [k]: prev[k] ?? formatForInput(Number(ligne.heures[jour] || 0)),
                            }));
                          }}
                          onChange={(e) => {
                            const k = `${key}:${jour}`;
                            setEditingHeures((prev) => ({ ...prev, [k]: e.target.value }));
                          }}
                          onBlur={(e) => {
                            const k = `${key}:${jour}`;
                            const parsed = parseHeuresInput(editingHeures[k] ?? e.target.value);
                            if (parsed === null) {
                              // input invalide => revert (ne modifie pas la valeur)
                              setEditingHeures((prev) => {
                                const next = { ...prev };
                                delete next[k];
                                return next;
                              });
                              return;
                            }
                            updateHeures(originalIndex, jour, parsed);
                            setEditingHeures((prev) => {
                              const next = { ...prev };
                              delete next[k];
                              return next;
                            });
                          }}
                          disabled={isLocked || cannotEdit}
                          min="0"
                          max="24"
                          step="0.5"
                          className={clsx(
                            'w-14 px-2 py-1 text-center rounded border text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-primary-500',
                            isLocked || cannotEdit
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                              : 'border-gray-300 hover:border-gray-400'
                          )}
                          placeholder="0"
                        />
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center font-semibold">
                    {formatHeuresQuart(Object.values(ligne.heures).reduce((s, h) => s + Number(h), 0))}
                  </td>
                  <td className="px-2 py-3">
                    {!isLocked && (
                      <button
                        onClick={() => removeLigne(originalIndex)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
                  );
                })}

              {/* Bouton ajouter projet */}
              {!isLocked && (
                <tr>
                  <td colSpan={10} className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddProjet(true)}
                      className="text-primary-600"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter un projet
                    </Button>
                  </td>
                </tr>
              )}

              {/* Ligne total par jour */}
              <tr className="bg-gray-100 font-semibold">
                <td className="px-4 py-3 text-gray-700">
                  Total journalier
                </td>
                {JOURS.map((jour) => (
                  <td key={jour} className="px-2 py-3 text-center text-gray-700">
                    {formatHeuresQuart(calculs.heuresParJour[jour])}
                  </td>
                ))}
                <td className="px-4 py-3 text-center text-primary-700">
                  {formatHeuresQuart(calculs.heuresTravaillees)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Résumé de la semaine */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total pointées</div>
          <div className="text-2xl font-bold text-gray-900">{formatHeuresQuart(calculs.heuresTravaillees)}</div>
        </Card>
      </div>

      {/* Boutons d'action */}
      {!isLocked && (
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate()}
            isLoading={saveMutation.isPending}
            disabled={submitMutation.isPending}
          >
            <Save className="w-4 h-4" />
            Enregistrer
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            isLoading={submitMutation.isPending || saveMutation.isPending}
            disabled={calculs.totalSemaine === 0 || saveMutation.isPending}
          >
            <Send className="w-4 h-4" />
            Soumettre pour validation
          </Button>
        </div>
      )}

      {/* Message si validé */}
      {validationStatus === 'Valide' && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Cette semaine a été validée</span>
          </div>
        </Card>
      )}

      {validationStatus === 'Soumis' && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-2 text-amber-800">
            <Clock className="w-5 h-5" />
            <span className="font-medium">Semaine soumise : en attente de validation — les modifications ne sont plus possibles.</span>
          </div>
        </Card>
      )}

      {/* Message si rejeté */}
      {validationStatus === 'Rejete' && semaineData?.validation?.commentaire_rejet && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Semaine rejetée : {semaineData.validation.commentaire_rejet}</span>
          </div>
        </Card>
      )}

      <Modal
        isOpen={showFeriesModal}
        onClose={() => setShowFeriesModal(false)}
        title="Jours fériés de la semaine"
        size="md"
      >
        {feriesSemaine.length === 0 ? (
          <p className="text-sm text-gray-600">Aucun jour férié sur cette semaine.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {feriesSemaine.map((jf) => {
              const d = joursSemaine.find(
                (day) => dayKeyForPointage(day) === String(jf.date).split('T')[0]
              );
              return (
                <li
                  key={jf.id + String(jf.date)}
                  className="flex justify-between gap-4 py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="font-medium text-red-800">{jf.libelle}</span>
                  <span className="text-gray-600 tabular-nums">
                    {d ? formatDate(d, 'EEEE d MMMM') : String(jf.date).split('T')[0]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-gray-500 mt-4">
          La liste provient du calendrier des jours fériés (toute l’année, pas seulement le 1er avril). Les
          administrateurs peuvent les modifier dans le menu « Jours fériés ».
        </p>
      </Modal>

      {/* Modal ajout projet */}
      <Modal
        isOpen={showAddProjet}
        onClose={() => {
          setShowAddProjet(false);
          setSelectedProjetId('');
          setSelectedTacheProjetId('');
        }}
        title="Ajouter un projet"
        size="sm"
      >
        <div className="space-y-4">
          <Select
            label="Projet"
            value={selectedProjetId}
            onChange={(e) => {
              setSelectedProjetId(e.target.value);
              setSelectedTacheProjetId('');
            }}
            options={[
              { value: '', label: 'Sélectionner un projet' },
              ...[...projetsDisponibles]
                .sort((a: any, b: any) =>
                  String(a.code_projet || '').localeCompare(String(b.code_projet || ''), 'fr', { numeric: true, sensitivity: 'base' })
                )
                .map((p: any) => ({
                value: p.id?.toString(),
                label: `${p.code_projet} - ${p.nom}`,
              })),
            ]}
          />
          
          {selectedProjetId && (
            <Select
              label="Tâche"
              value={selectedTacheProjetId}
              onChange={(e) => setSelectedTacheProjetId(e.target.value)}
              options={[
                { value: '', label: 'Sélectionner une tâche' },
                ...(() => {
                  const compareCodes = (codeA: string, codeB: string) => {
                    const a = String(codeA || '').trim();
                    const b = String(codeB || '').trim();
                    if (!a && !b) return 0;
                    if (!a) return 1;
                    if (!b) return -1;

                    const isNumA = /^\d+$/.test(a);
                    const isNumB = /^\d+$/.test(b);
                    if (isNumA && isNumB) return parseInt(a, 10) - parseInt(b, 10);
                    if (isNumA && !isNumB) return -1;
                    if (!isNumA && isNumB) return 1;
                    return a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' });
                  };

                  const rawAffectations =
                    projetsDisponibles.find((p: any) => p.id?.toString() === selectedProjetId)?.affectations || [];

                  const options = rawAffectations
                    .map((a: any) => {
                      // Déterminer le nom et le code de la tâche
                      let tacheNom = 'Tâche';
                      let tacheCode = '';
                      if (a.tache_projet?.nom_tache) {
                        // Tâche personnalisée avec nom_tache
                        tacheNom = a.tache_projet.nom_tache;
                        tacheCode = a.tache_projet.code || a.tache_projet.tache_type?.code || '';
                      } else if (a.tache_projet?.tache_type?.tache_type) {
                        // Tâche personnalisée avec tache_type
                        tacheNom = a.tache_projet.tache_type.tache_type;
                        tacheCode = a.tache_projet.code || a.tache_projet.tache_type?.code || '';
                      } else if (a.tache_type?.tache_type) {
                        // Tâche globale
                        tacheNom = a.tache_type.tache_type;
                        tacheCode = a.tache_type.code || '';
                      }

                      return {
                        // On se base sur la tâche par projet pour que l'UI marche
                        // même si tache_type_id est NULL.
                        value: a.tache_projet_id?.toString() || '',
                        label: tacheCode ? `${tacheCode} - ${tacheNom}` : tacheNom,
                        code: tacheCode,
                      };
                    })
                    .filter((o: any) => o.value);

                  return options
                    .slice()
                    .sort((x: any, y: any) => compareCodes(String(x.code || ''), String(y.code || '')))
                    .map(({ code: _code, ...rest }: any) => rest);
                })(),
              ]}
            />
          )}
          
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => {
              setShowAddProjet(false);
              setSelectedProjetId('');
              setSelectedTacheProjetId('');
            }}>
              Annuler
            </Button>
            <Button onClick={addLigne} disabled={!selectedProjetId || !selectedTacheProjetId}>
              Ajouter
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};