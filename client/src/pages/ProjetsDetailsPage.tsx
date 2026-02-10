import { useQuery } from '@tanstack/react-query';
import { projetsApi } from '@/services/api';
import { ChevronDown, ChevronRight, FolderKanban, Clock, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { useState } from 'react';

interface TacheDetail {
  id: string;
  tache_type_id: string;
  tache_type: string;
  code: string;
  heures_prevues: number;
  heures_totales: number;
  ecart_heures: number;
  heures_par_salarie: {
    salarie_id: string;
    nom: string;
    prenom: string;
    heures: number;
  }[];
}

interface ProjetDetail {
  id: string;
  nom: string;
  code_projet: string | null;
  archive?: boolean;
  client: {
    id: string;
    nom: string;
    code_client: string | null;
  } | null;
  status: {
    id: string;
    status: string;
    couleur: string | null;
  } | null;
  created_at: string;
  taches: TacheDetail[];
}

export const ProjetsDetailsPage = () => {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const { data: projets = [], isLoading } = useQuery({
    queryKey: ['projets-details'],
    queryFn: () => projetsApi.getDetails(),
    refetchInterval: 60000, // Rafraîchir toutes les minutes
  });

  const toggleProject = (projetId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projetId)) {
      newExpanded.delete(projetId);
    } else {
      newExpanded.add(projetId);
    }
    setExpandedProjects(newExpanded);
  };

  const formatHeures = (heures: number): string => {
    return `${heures.toFixed(1)}h`;
  };

  const getEcartColor = (ecart: number): string => {
    if (ecart > 0) return 'text-red-600'; // Dépassement
    if (ecart < 0) return 'text-green-600'; // Sous-consommation
    return 'text-gray-600'; // Égal
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FolderKanban className="w-6 h-6" />
          Détails des projets
        </h1>
        <p className="text-gray-600 mt-1">Vue détaillée des heures estimées et réelles par projet et par tâche</p>
      </div>

      {projets.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">Aucun projet trouvé</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(projets as ProjetDetail[])
            .slice()
            .sort((a, b) => {
              // Projets archivés en bas
              if (a.archive && !b.archive) return 1;
              if (!a.archive && b.archive) return -1;
              // Trier par code_projet en ordre croissant pour les projets non archivés
              const codeA = a.code_projet || '';
              const codeB = b.code_projet || '';
              return codeA.localeCompare(codeB, 'fr', { numeric: true, sensitivity: 'base' });
            })
            .map((projet) => {
            const isExpanded = expandedProjects.has(projet.id);
            const totalHeuresEstimees = projet.taches.reduce((sum, t) => sum + t.heures_prevues, 0);
            const totalHeuresReelles = projet.taches.reduce((sum, t) => sum + t.heures_totales, 0);
            const totalEcart = totalHeuresReelles - totalHeuresEstimees;

            return (
              <div key={projet.id} className={`bg-white rounded-lg shadow ${projet.archive ? 'opacity-60 bg-gray-50' : ''}`}>
                {/* En-tête du projet */}
                <button
                  onClick={() => toggleProject(projet.id)}
                  className={`w-full px-6 py-4 flex items-center justify-between transition-colors ${projet.archive ? 'hover:bg-gray-100' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-3">
                        {projet.code_projet && (
                          <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {projet.code_projet}
                          </span>
                        )}
                        <h2 className="text-lg font-semibold text-gray-900">
                          {projet.nom}
                        </h2>
                        {projet.status && (
                          <span
                            className="text-xs px-2 py-1 rounded text-white"
                            style={{
                              backgroundColor: projet.status.couleur || '#3B82F6'
                            }}
                          >
                            {projet.status.status}
                          </span>
                        )}
                      </div>
                      {projet.client && (
                        <p className="text-sm text-gray-600 mt-1">
                          Client: {projet.client.nom}
                          {projet.client.code_client && ` (${projet.client.code_client})`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <div className="text-gray-500">Heures estimées</div>
                        <div className="font-semibold text-gray-900">
                          {formatHeures(totalHeuresEstimees)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-gray-500">Heures réelles</div>
                        <div className="font-semibold text-gray-900">
                          {formatHeures(totalHeuresReelles)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-gray-500">Écart</div>
                        <div className={`font-semibold ${getEcartColor(totalEcart)}`}>
                          {totalEcart >= 0 ? '+' : ''}{formatHeures(totalEcart)}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Détails des tâches (accordéon) */}
                {isExpanded && (
                  <div className="border-t border-gray-200">
                    {projet.taches.length === 0 ? (
                      <div className="px-6 py-8 text-center text-gray-500">
                        Aucune tâche pour ce projet
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Tâche
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Heures estimées
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Heures réelles
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Écart
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Salariés
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {projet.taches
                              .slice()
                              .sort((a, b) => {
                                // Trier par nom de tâche en ordre alphabétique
                                const nomA = a.tache_type || '';
                                const nomB = b.tache_type || '';
                                return nomA.localeCompare(nomB, 'fr', { sensitivity: 'base' });
                              })
                              .map((tache) => (
                              <tr key={tache.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    {tache.code && (
                                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                        {tache.code}
                                      </span>
                                    )}
                                    <span className="text-sm font-medium text-gray-900">
                                      {tache.tache_type}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                                  {formatHeures(tache.heures_prevues)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                                  {formatHeures(tache.heures_totales)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <div className={`text-sm font-semibold flex items-center justify-end gap-1 ${getEcartColor(tache.ecart_heures)}`}>
                                    {tache.ecart_heures > 0 ? (
                                      <TrendingUp className="w-4 h-4" />
                                    ) : tache.ecart_heures < 0 ? (
                                      <TrendingDown className="w-4 h-4" />
                                    ) : null}
                                    {tache.ecart_heures >= 0 ? '+' : ''}{formatHeures(tache.ecart_heures)}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  {tache.heures_par_salarie.length === 0 ? (
                                    <span className="text-sm text-gray-400">Aucun salarié</span>
                                  ) : (
                                    <div className="space-y-2">
                                      {tache.heures_par_salarie.map((salarie) => (
                                        <div
                                          key={salarie.salarie_id}
                                          className="flex items-center justify-between text-sm"
                                        >
                                          <span className="text-gray-700">
                                            {salarie.prenom} {salarie.nom}
                                          </span>
                                          <span className="text-gray-900 font-medium ml-4">
                                            {formatHeures(salarie.heures)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
