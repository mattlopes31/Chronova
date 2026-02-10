import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      toast.success(`Bienvenue, ${data.user.prenom} !`);
      navigate(data.user.role === 'Admin' ? '/dashboard' : '/pointage');
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
    <div className="min-h-screen flex flex-col items-center pt-16 pb-8 px-8 bg-gradient-to-br from-blue-900 via-blue-950 to-black relative overflow-hidden">
      {/* Effets de fond */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }} />
      </div>
      
      {/* Orbes de lumière */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-800/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      {/* Logo en haut */}
      <div className="relative z-10 flex items-center justify-center gap-3 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/50">
          <Clock className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white">Chronova</h1>
          <p className="text-blue-300 font-medium">Gestion du temps</p>
        </div>
      </div>

      {/* Formulaire centré verticalement */}
      <div className="relative z-10 w-full max-w-md flex-1 flex items-center justify-center">

        <div className="bg-gradient-to-br from-blue-700/60 via-blue-800/60 to-blue-900/60 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/10 p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white">Connexion</h2>
            <p className="text-gray-300 mt-2">Accédez à votre espace de travail</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-white/10 bg-black/20 backdrop-blur-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30 transition-all"
                  placeholder="votre@email.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 rounded-xl border border-white/10 bg-black/20 backdrop-blur-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full py-3 bg-blue-600/90 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 backdrop-blur-sm"
              isLoading={loginMutation.isPending}
            >
              Se connecter
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
