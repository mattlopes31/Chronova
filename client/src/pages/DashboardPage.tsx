import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  FolderKanban,
  Clock,
  CheckCircle,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import { dashboardApi } from '@/services/api';
import { Card, Spinner, Badge } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';

export const DashboardPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'Admin';


  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
    enabled: isAdmin,
  });

  const { data: mesStats } = useQuery({
    queryKey: ['mes-stats'],
    queryFn: () => dashboardApi.getMesStats(),
  });

  const { data: validations = [] } = useQuery({
    queryKey: ['validations-pending'],
    queryFn: () => dashboardApi.getValidations(),
    enabled: isAdmin,
  });

  if (isLoading) {
    return <Spinner className="py-20" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour, {user?.prenom} 👋
        </h1>
        <p className="text-gray-500">
          Voici un aperçu de votre activité
        </p>
      </div>

      {/* Stats personnelles */}
      {mesStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Heures cette semaine</p>
                <p className="text-2xl font-bold text-gray-900">{mesStats.heures_semaine}h</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Heures ce mois</p>
                <p className="text-2xl font-bold text-gray-900">{mesStats.heures_mois}h</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-accent-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-accent-600" />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Projets assignés</p>
                <p className="text-2xl font-bold text-gray-900">{mesStats.nb_projets}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
                <FolderKanban className="w-6 h-6 text-violet-600" />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Status semaine</p>
                <Badge variant={
                  mesStats.status_semaine === 'Valide' ? 'success' :
                  mesStats.status_semaine === 'Soumis' ? 'info' :
                  mesStats.status_semaine === 'Rejete' ? 'danger' : 'default'
                }>
                  {mesStats.status_semaine}
                </Badge>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Stats admin */}
      {isAdmin && stats && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mt-8">Vue d'ensemble</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Salariés actifs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.nb_salaries}</p>
                </div>
                <Users className="w-8 h-8 text-primary-500" />
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Projets en cours</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.nb_projets}</p>
                </div>
                <FolderKanban className="w-8 h-8 text-accent-500" />
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Clients</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.nb_clients}</p>
                </div>
                <Users className="w-8 h-8 text-violet-500" />
              </div>
            </Card>
            <Card className={`p-5 ${stats.nb_pointages_en_attente > 0 ? 'bg-amber-50 border-amber-200' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pointages en attente</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.nb_pointages_en_attente}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Heures semaine</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_heures_semaine}h</p>
                </div>
                <Clock className="w-8 h-8 text-gray-500" />
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Validations en attente - Version cartes */}
      {isAdmin && validations.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mt-8">Validations en attente</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(() => {
              // Regrouper par salarié
              const groupedBySalarie = validations.reduce((acc: any, v: any) => {
                const salarieId = String(v.salarie_id || v.salarie?.id || '');
                if (!salarieId) return acc;
                
                if (!acc[salarieId]) {
                  acc[salarieId] = {
                    salarie: v.salarie,
                    semaines: [],
                    totalHeures: 0,
                  };
                }
                
                // Convertir correctement les heures en nombre
                const heuresSemaine = Number(v.total_heures_travaillees || v.total_heures || 0);
                if (isNaN(heuresSemaine)) {
                  console.warn('Heures invalides pour la semaine:', v);
                  return acc;
                }
                
                acc[salarieId].semaines.push({
                  annee: Number(v.annee),
                  semaine: Number(v.semaine),
                  heures: heuresSemaine,
                  heuresSup: Number(v.heures_sup || 0),
                  heuresDues: Number(v.heures_dues || 0),
                  heuresRattrapees: Number(v.heures_rattrapees || 0),
                });
                acc[salarieId].totalHeures = Number(acc[salarieId].totalHeures) + heuresSemaine;
                return acc;
              }, {});

              return Object.values(groupedBySalarie).map((group: any, idx: number) => (
                <Card key={group.salarie?.id || idx} className="p-5 hover:shadow-lg transition-shadow">
                  {/* En-tête du salarié */}
                  <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-base font-semibold text-primary-700">
                          {group.salarie?.prenom?.[0]}{group.salarie?.nom?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-lg">
                          {group.salarie?.prenom} {group.salarie?.nom}
                        </p>
                        <p className="text-sm text-gray-500">
                          {group.semaines.length} semaine{group.semaines.length > 1 ? 's' : ''} en attente
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {Math.round(group.totalHeures)}h
                      </div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                  </div>

                  {/* Liste des semaines */}
                  <div className="space-y-2 mb-4">
                    {group.semaines.map((sem: any) => (
                      <div
                        key={`${sem.annee}-${sem.semaine}`}
                        className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-200 flex items-center justify-center">
                              <span className="text-xs font-bold text-blue-900">
                                S{sem.semaine}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                Semaine {sem.semaine} - {sem.annee}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-blue-700">
                              {sem.heures.toFixed(1)}h
                            </span>
                          </div>
                        </div>
                        <div className="ml-12 space-y-0.5">
                          <p className="text-xs text-gray-600">
                            Total: <span className="font-semibold text-gray-900">{sem.heures.toFixed(1)}h</span>
                          </p>
                          {sem.heuresSup !== undefined && sem.heuresSup > 0 && (
                            <p className="text-xs text-green-600">
                              Heures sup: <span className="font-semibold">{sem.heuresSup.toFixed(1)}h</span>
                            </p>
                          )}
                          {sem.heuresDues !== undefined && sem.heuresDues > 0 && (
                            <p className="text-xs text-red-600">
                              Heures dues: <span className="font-semibold">{sem.heuresDues.toFixed(1)}h</span>
                            </p>
                          )}
                          {sem.heuresRattrapees !== undefined && sem.heuresRattrapees > 0 && (
                            <p className="text-xs text-blue-600">
                              Heures rattrapées: <span className="font-semibold">{sem.heuresRattrapees.toFixed(1)}h</span>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Lien vers la page Validations */}
                  <div className="flex items-center justify-center pt-3 border-t border-gray-100">
                    <button
                      onClick={() => navigate('/validations')}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                    >
                      Voir les détails →
                    </button>
                  </div>
                </Card>
              ));
            })()}
          </div>
        </>
      )}

      {/* Projets de l'utilisateur */}
      {mesStats?.projets && mesStats.projets.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mt-8">Mes projets</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mesStats.projets.map((projet: any) => (
              <Card key={projet.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <FolderKanban className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{projet.nom}</h3>
                    <p className="text-sm text-gray-500">{projet.code_projet}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
