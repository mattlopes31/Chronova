import { useNavigate } from 'react-router-dom';
import {
  Users,
  FolderKanban,
  Clock,
  CheckCircle,
  Calendar,
  CalendarDays,
  Building2,
} from 'lucide-react';
import { Card } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';

interface NavigationBlock {
  name: string;
  href: string;
  icon: any;
  color: string;
  bgColor: string;
  description?: string;
}

export const DashboardPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'Admin';
  const isManager = user?.role === 'Manager' || isAdmin;

  // Définir les blocs de navigation selon le rôle
  const navigationBlocks: NavigationBlock[] = [];

  if (isAdmin) {
    navigationBlocks.push(
      { name: 'Calendrier', href: '/calendrier', icon: Calendar, color: 'text-blue-600', bgColor: 'bg-blue-100', description: 'Gérer le calendrier' },
      { name: 'Calendrier view', href: '/calendrier-view', icon: CalendarDays, color: 'text-purple-600', bgColor: 'bg-purple-100', description: 'Vue calendrier' },
      { name: 'Validations', href: '/validations', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100', description: 'Valider les pointages' },
      { name: 'Détails projets', href: '/projets-details', icon: FolderKanban, color: 'text-indigo-600', bgColor: 'bg-indigo-100', description: 'Détails des projets' },
      { name: 'Projets', href: '/projets', icon: FolderKanban, color: 'text-amber-600', bgColor: 'bg-amber-100', description: 'Gérer les projets' },
      { name: 'Clients', href: '/clients', icon: Building2, color: 'text-teal-600', bgColor: 'bg-teal-100', description: 'Gérer les clients' },
      { name: 'Salariés', href: '/salaries', icon: Users, color: 'text-pink-600', bgColor: 'bg-pink-100', description: 'Gérer les salariés' },
    );
  } else if (isManager) {
    navigationBlocks.push(
      { name: 'Pointage', href: '/pointage', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100', description: 'Saisir vos heures' },
      { name: 'Validations', href: '/validations', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100', description: 'Valider les pointages' },
    );
  } else {
    navigationBlocks.push(
      { name: 'Pointage', href: '/pointage', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100', description: 'Saisir vos heures' },
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour, {user?.prenom} 👋
        </h1>
        <p className="text-gray-500">
          Accédez rapidement aux différentes sections
        </p>
      </div>

      {/* Blocs de navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {navigationBlocks.map((block) => {
          const Icon = block.icon;
          return (
            <Card
              key={block.href}
              className="p-6 hover:shadow-lg transition-all cursor-pointer group border-2 hover:border-primary-300"
              onClick={(e) => {
                e.preventDefault();
                console.log('Navigation vers:', block.href);
                navigate(block.href);
              }}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className={`w-16 h-16 rounded-xl ${block.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-8 h-8 ${block.color}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg group-hover:text-primary-600 transition-colors">
                    {block.name}
                  </h3>
                  {block.description && (
                    <p className="text-sm text-gray-500 mt-1">
                      {block.description}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
