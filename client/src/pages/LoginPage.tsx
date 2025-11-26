import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Clock, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input } from '@/components/ui';

export const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data.user, data.token);
      toast.success(`Bienvenue, ${data.user.firstName} !`);
      navigate(data.user.role === 'ADMIN' ? '/dashboard' : '/calendar');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Identifiants incorrects');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-neutral-850 via-neutral-900 to-neutral-950 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }} />
        </div>
        
        {/* Gradient orbs */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent-500/30 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-glow">
              <Clock className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Chronova</h1>
              <p className="text-primary-400 font-medium">pro</p>
            </div>
          </div>
          
          <h2 className="text-3xl font-semibold text-white mb-4">
            Gestion du temps simplifiée
          </h2>
          <p className="text-neutral-400 text-lg max-w-md leading-relaxed">
            Suivez vos heures par projet et tâche, gérez vos équipes et visualisez 
            la productivité en temps réel.
          </p>
          
          <div className="mt-12 grid grid-cols-2 gap-6">
            {[
              { label: 'Pointage facile', value: 'Calendrier intuitif' },
              { label: 'Validation', value: 'Hebdomadaire' },
              { label: 'Rapports', value: 'Détaillés' },
              { label: 'Multi-projets', value: 'Assignations' },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                <p className="text-neutral-400 text-sm">{item.label}</p>
                <p className="text-white font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Clock className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-neutral-900">Chronovo</span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-neutral-900">Connexion</h2>
              <p className="text-neutral-500 mt-2">Accédez à votre espace de travail</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-neutral-700">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="votre@email.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-neutral-700">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Mot de passe oublié ?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full py-3"
                isLoading={loginMutation.isPending}
              >
                Se connecter
              </Button>
            </form>

            <div className="mt-6 p-4 bg-neutral-50 rounded-xl">
              <p className="text-xs text-neutral-500 text-center">
                <strong>Comptes de démo :</strong><br />
                Admin: admin@timetrack.com / Admin123!<br />
                Employé: jean.dupont@timetrack.com / Employee123!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
