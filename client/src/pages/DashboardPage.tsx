import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  FolderKanban,
  Clock,
  CalendarCheck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { dashboardApi } from '@/services/api';
import { Card, Spinner, Select, Badge } from '@/components/ui';
import { formatMonthYear } from '@/utils/dates';

const COLORS = ['#0066FF', '#00D4AA', '#FF6B6B', '#FFE66D', '#4ECDC4', '#9B59B6', '#3498DB', '#E67E22'];

export const DashboardPage = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary', selectedMonth, selectedYear],
    queryFn: () => dashboardApi.getSummary(selectedMonth, selectedYear),
  });

  const { data: trend = [] } = useQuery({
    queryKey: ['dashboard-trend', selectedYear],
    queryFn: () => dashboardApi.getTrend(selectedYear),
  });

  const { data: comparison = [] } = useQuery({
    queryKey: ['dashboard-comparison'],
    queryFn: () => dashboardApi.getComparison(),
  });

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: formatMonthYear(i, selectedYear),
  }));

  const years = Array.from({ length: 5 }, (_, i) => ({
    value: String(now.getFullYear() - i),
    label: String(now.getFullYear() - i),
  }));

  if (summaryLoading) {
    return <Spinner className="py-20" />;
  }

  const stats = [
    {
      label: 'Heures ce mois',
      value: `${summary?.totals.monthlyHours.toFixed(1) || 0}h`,
      icon: Clock,
      color: 'from-primary-500 to-primary-600',
      trend: '+12%',
      trendUp: true,
    },
    {
      label: 'Heures cette année',
      value: `${summary?.totals.yearlyHours.toFixed(1) || 0}h`,
      icon: TrendingUp,
      color: 'from-accent-500 to-accent-600',
      trend: '+8%',
      trendUp: true,
    },
    {
      label: 'Employés actifs',
      value: summary?.totals.employeesCount || 0,
      icon: Users,
      color: 'from-violet-500 to-violet-600',
    },
    {
      label: 'Projets actifs',
      value: summary?.totals.projectsCount || 0,
      icon: FolderKanban,
      color: 'from-amber-500 to-amber-600',
    },
    {
      label: 'Congés en attente',
      value: summary?.totals.pendingLeaves || 0,
      icon: CalendarCheck,
      color: summary?.totals.pendingLeaves ? 'from-red-500 to-red-600' : 'from-green-500 to-green-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
          <p className="text-neutral-500">Vue d'ensemble de l'activité</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={String(selectedMonth)}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            options={months}
            className="w-40"
          />
          <Select
            value={String(selectedYear)}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            options={years}
            className="w-28"
          />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-neutral-500">{stat.label}</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">{stat.value}</p>
                {stat.trend && (
                  <div className={`flex items-center gap-1 mt-2 text-sm ${stat.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.trendUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {stat.trend}
                  </div>
                )}
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly trend */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Tendance annuelle</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="monthName" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}h`, 'Heures']}
                />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="#0066FF"
                  strokeWidth={3}
                  dot={{ fill: '#0066FF', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#0066FF' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Hours by project */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Heures par projet</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summary?.hoursByProject || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="hours"
                  nameKey="project.name"
                  label={({ project, hours }) => `${project?.name?.slice(0, 10)}... (${hours}h)`}
                  labelLine={false}
                >
                  {(summary?.hoursByProject || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value}h`, 'Heures']}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Hours by employee */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Heures par employé</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={summary?.hoursByEmployee?.map((item) => ({
                name: `${item.employee?.firstName} ${item.employee?.lastName?.charAt(0)}.`,
                hours: item.hours,
              })) || []}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#9ca3af" fontSize={12} />
              <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={90} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`${value}h`, 'Heures']}
              />
              <Bar dataKey="hours" fill="#0066FF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Project comparison */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Comparaison Estimé vs Réalisé</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-600">Projet</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-600">Estimé</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-600">Réalisé</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-600">Écart</th>
                <th className="py-3 px-4 text-sm font-semibold text-neutral-600">Progression</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {comparison.map((project) => {
                const progress = project.estimated > 0
                  ? Math.min((project.actual / project.estimated) * 100, 150)
                  : 0;
                const isOverBudget = project.variance > 0;

                return (
                  <tr key={project.project.id} className="hover:bg-neutral-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-neutral-900">{project.project.name}</div>
                      <div className="text-sm text-neutral-500">{project.project.code}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">{project.estimated}h</td>
                    <td className="py-3 px-4 text-right font-medium">{project.actual.toFixed(1)}h</td>
                    <td className="py-3 px-4 text-right">
                      <Badge variant={isOverBudget ? 'danger' : 'success'}>
                        {isOverBudget ? '+' : ''}{project.variance.toFixed(1)}h
                      </Badge>
                    </td>
                    <td className="py-3 px-4 w-48">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progress > 100 ? 'bg-red-500' : 'bg-primary-500'
                            }`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-neutral-600 w-12 text-right">
                          {progress.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
