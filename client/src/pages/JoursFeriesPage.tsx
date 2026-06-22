import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import { congesApi } from '@/services/api';
import { Card, Spinner, Button, Input } from '@/components/ui';
import toast from 'react-hot-toast';
import type { JourFerie } from '@/types';

export const JoursFeriesPage = () => {
  const queryClient = useQueryClient();
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [nouvelleDate, setNouvelleDate] = useState('');
  const [nouveauNom, setNouveauNom] = useState('');

  const { data: liste = [], isLoading } = useQuery({
    queryKey: ['jours-feries', annee],
    queryFn: () => congesApi.getJoursFeries(annee),
  });

  const triee = useMemo(
    () => [...liste].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [liste]
  );

  const createMutation = useMutation({
    mutationFn: () => congesApi.createJourFerie({ date: nouvelleDate, nom: nouveauNom.trim() }),
    onSuccess: () => {
      toast.success('Jour férié ajouté');
      setNouvelleDate('');
      setNouveauNom('');
      queryClient.invalidateQueries({ queryKey: ['jours-feries'] });
      queryClient.invalidateQueries({ queryKey: ['jours-feries-cal-view'] });
      queryClient.invalidateQueries({ queryKey: ['jours-feries-calendrier'] });
      queryClient.invalidateQueries({ queryKey: ['pointage-semaine'] });
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || 'Impossible d’ajouter ce jour férié');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => congesApi.deleteJourFerie(id),
    onSuccess: () => {
      toast.success('Jour férié supprimé');
      queryClient.invalidateQueries({ queryKey: ['jours-feries'] });
      queryClient.invalidateQueries({ queryKey: ['jours-feries-cal-view'] });
      queryClient.invalidateQueries({ queryKey: ['jours-feries-calendrier'] });
      queryClient.invalidateQueries({ queryKey: ['pointage-semaine'] });
    },
    onError: () => toast.error('Suppression impossible'),
  });

  const anneesSelect = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1, y + 2];
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Jours fériés</h1>
        <p className="text-gray-600 mt-1">
          Les dates définies ici s’appliquent au pointage, aux calendriers et aux calculs (objectif hebdo, heures sup).
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={annee}
              onChange={(e) => setAnnee(parseInt(e.target.value, 10))}
            >
              {anneesSelect.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-gray-50 mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Ajouter un jour férié
          </h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <Input
                type="date"
                value={nouvelleDate}
                onChange={(e) => setNouvelleDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">Libellé</label>
              <Input
                value={nouveauNom}
                onChange={(e) => setNouveauNom(e.target.value)}
                placeholder="ex. 1er avril"
              />
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!nouvelleDate || !nouveauNom.trim() || createMutation.isPending}
            >
              Enregistrer
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : triee.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucun jour férié pour {annee}.</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Libellé</th>
                  <th className="w-24 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {triee.map((jf: JourFerie) => (
                  <tr key={jf.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-900">{jf.date}</td>
                    <td className="px-4 py-3 text-gray-800">{jf.libelle}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Supprimer le jour férié du ${jf.date} ?`)) {
                            deleteMutation.mutate(jf.id);
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-4 flex items-start gap-2">
          <Calendar className="w-4 h-4 shrink-0 mt-0.5" />
          Un jour férié non pointé compte comme 7h pour l’objectif de la semaine ; l’objectif devient 35h − 7h ×
          (nombre de fériés dans la semaine). Les heures saisies un férié sont des heures sup et nécessitent la case
          « Déplacement » côté salarié.
        </p>
      </Card>
    </div>
  );
};
