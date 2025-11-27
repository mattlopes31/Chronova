import { useQuery } from '@tanstack/react-query';
import {
  Users,
  FolderKanban,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { dashboardApi } from '@/services/api';
import { Card, Spinner, Badge } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';

export const DashboardPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
    enabled: isAdmin,
  });

  const { data: mesStats } = useQuery({
    queryKey: ['mes-stats'],
    queryFn: dashboardApi.getMesStats,
  });

  const { data: validations = [] } = useQuery({
    queryKey: ['validations-pending'],
    queryFn: dashboardApi.getValidations,
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

      {/* Validations en attente */}
      {isAdmin && validations.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mt-8">Validations en attente</h2>
          <Card className="overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Salarié</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Semaine</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Total heures</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {validations.map((v: any) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {v.salarie?.prenom} {v.salarie?.nom}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      S{v.semaine} - {v.annee}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold">
                      {v.total_heures_travaillees}h
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Badge variant="warning">En attente</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
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
