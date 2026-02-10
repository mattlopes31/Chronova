import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Clock,
  FolderKanban,
  Users,
  Building2,
  CalendarOff,
  Calendar,
  CalendarDays,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  CheckCircle,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { dashboardApi } from '@/services/api';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();

  // Récupérer les notifications (avec rafraîchissement automatique)
  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => dashboardApi.getNotifications(),
    refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
    refetchOnWindowFocus: true, // Rafraîchir quand on revient sur la fenêtre
  });

  const unreadCount = notifications.filter((n: any) => !n.lu).length;
  
  // Debug: afficher les notifications dans la console
  if (notifications.length > 0) {
    console.log('Notifications reçues:', notifications);
  }

  // Marquer une notification comme lue
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => dashboardApi.marquerNotificationLue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const isAdmin = user?.role === 'Admin';
  const isManager = user?.role === 'Manager' || isAdmin;

  const employeeNavigation = [
    { name: 'Pointage', href: '/pointage', icon: Clock },
    { name: 'Mes congés', href: '/conges', icon: CalendarOff },
  ];

  const managerNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Pointage', href: '/pointage', icon: Clock },
    { name: 'Validations', href: '/validations', icon: CheckCircle },
    { name: 'Congés', href: '/conges', icon: CalendarOff },
  ];

  const adminNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Calendrier', href: '/calendrier', icon: Calendar },
    { name: 'Calendrier view', href: '/calendrier-view', icon: CalendarDays },
    { name: 'Validations', href: '/validations', icon: CheckCircle },
    { name: 'Détails projets', href: '/projets-details', icon: FolderKanban },
    { name: 'Projets', href: '/projets', icon: FolderKanban },
    { name: 'Clients', href: '/clients', icon: Building2 },
    { name: 'Salariés', href: '/salaries', icon: Users },
    { name: 'Congés', href: '/conges', icon: CalendarOff },
  ];

  const navigation = isAdmin ? adminNavigation : isManager ? managerNavigation : employeeNavigation;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Chronova</span>
            </Link>
            <button
              className="lg:hidden p-2 text-gray-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-gray-800">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm">
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.prenom} {user?.nom}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user?.role}</p>
                </div>
                <ChevronDown className={clsx(
                  'w-4 h-4 text-gray-400 transition-transform',
                  userMenuOpen && 'rotate-180'
                )} />
              </button>

              {userMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
                  <Link
                    to="/settings"
                    className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4" />
                    Paramètres
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            <button
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1 lg:flex-none" />

            <div className="flex items-center gap-4">
              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>
                
                {/* Dropdown notifications */}
                {notificationsOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setNotificationsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
                      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                          <span className="text-xs text-gray-500">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</span>
                        )}
                      </div>
                      <div className="overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center text-gray-500 text-sm">
                            Aucune notification
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {notifications.map((notification: any) => (
                              <div
                                key={notification.id}
                                className={clsx(
                                  'px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors',
                                  !notification.lu && 'bg-blue-50/50'
                                )}
                                onClick={() => {
                                  if (!notification.lu) {
                                    markAsReadMutation.mutate(notification.id.toString());
                                  }
                                  if (notification.lien) {
                                    navigate(notification.lien);
                                    setNotificationsOpen(false);
                                  }
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={clsx(
                                    'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                                    notification.type === 'success' && 'bg-green-500',
                                    notification.type === 'warning' && 'bg-yellow-500',
                                    notification.type === 'error' && 'bg-red-500',
                                    notification.type === 'info' && 'bg-blue-500',
                                    notification.lu && 'opacity-30'
                                  )} />
                                  <div className="flex-1 min-w-0">
                                    <p className={clsx(
                                      'text-sm font-medium',
                                      !notification.lu ? 'text-gray-900' : 'text-gray-600'
                                    )}>
                                      {notification.titre}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                      {notification.message}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                      {new Date(notification.created_at).toLocaleDateString('fr-FR', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <span className="hidden sm:block text-sm text-gray-500">
                {new Date().toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
