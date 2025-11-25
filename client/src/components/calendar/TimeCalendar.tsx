import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Lock,
  Unlock,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { timeEntriesApi, holidaysApi, leavesApi, usersApi } from '@/services/api';
import { Button, Modal, Select, Input, Card, Badge, Spinner } from '@/components/ui';
import {
  getMonthWeeks,
  formatMonthYear,
  getNextMonth,
  getPreviousMonth,
  formatDate,
  getDayShortName,
  isWeekend,
  isSameDay,
  parseISO,
  format,
} from '@/utils/dates';
import type { TimeEntry, PublicHoliday, LeaveDate, Project, Task } from '@/types';

interface TimeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  existingEntry?: TimeEntry;
  projects: Project[];
  onSave: (data: { projectId: string; taskId: string; hours: number; description?: string }) => void;
  isLoading: boolean;
}

const TimeEntryModal = ({
  isOpen,
  onClose,
  date,
  existingEntry,
  projects,
  onSave,
  isLoading,
}: TimeEntryModalProps) => {
  const [selectedProjectId, setSelectedProjectId] = useState(existingEntry?.projectId || '');
  const [selectedTaskId, setSelectedTaskId] = useState(existingEntry?.taskId || '');
  const [hours, setHours] = useState(existingEntry?.hours?.toString() || '');
  const [description, setDescription] = useState(existingEntry?.description || '');

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const tasks = selectedProject?.tasks || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedTaskId || !hours) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    onSave({
      projectId: selectedProjectId,
      taskId: selectedTaskId,
      hours: parseFloat(hours),
      description: description || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Pointage - ${formatDate(date, 'EEEE d MMMM yyyy')}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Projet *"
          value={selectedProjectId}
          onChange={(e) => {
            setSelectedProjectId(e.target.value);
            setSelectedTaskId('');
          }}
          options={[
            { value: '', label: 'Sélectionner un projet' },
            ...projects.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` })),
          ]}
        />

        <Select
          label="Tâche *"
          value={selectedTaskId}
          onChange={(e) => setSelectedTaskId(e.target.value)}
          disabled={!selectedProjectId}
          options={[
            { value: '', label: 'Sélectionner une tâche' },
            ...tasks.map((t) => ({ value: t.id, label: `${t.code} - ${t.label}` })),
          ]}
        />

        <Input
          type="number"
          label="Heures *"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          min="0.5"
          max="24"
          step="0.5"
          placeholder="Ex: 8"
        />

        <Input
          label="Description (optionnel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notes sur le travail effectué..."
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export const TimeCalendar = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(isAdmin ? undefined : user?.id);

  const weeks = useMemo(() => getMonthWeeks(currentMonth, currentYear), [currentMonth, currentYear]);

  // Get date range for the month view
  const startDate = weeks[0]?.days[0];
  const endDate = weeks[weeks.length - 1]?.days[6];

  // Fetch data
  const { data: projects = [] } = useQuery({
    queryKey: ['user-projects', user?.id],
    queryFn: () => usersApi.getProjects(user!.id),
    enabled: !!user?.id,
  });

  const { data: timeEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['time-entries', currentMonth, currentYear, selectedUserId],
    queryFn: () =>
      isAdmin && !selectedUserId
        ? timeEntriesApi.getAllEntries({
            startDate: format(startDate, 'yyyy-MM-dd'),
            endDate: format(endDate, 'yyyy-MM-dd'),
          })
        : timeEntriesApi.getMyEntries({
            startDate: format(startDate, 'yyyy-MM-dd'),
            endDate: format(endDate, 'yyyy-MM-dd'),
          }),
    enabled: !!startDate && !!endDate,
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', currentYear],
    queryFn: () => holidaysApi.getByYear(currentYear),
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ['leaves-calendar', startDate, endDate],
    queryFn: () =>
      leavesApi.getCalendarLeaves(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      ),
    enabled: !!startDate && !!endDate,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll(),
    enabled: isAdmin,
  });

  // Mutations
  const createEntryMutation = useMutation({
    mutationFn: timeEntriesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Pointage enregistré');
      setModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    },
  });

  const validateWeekMutation = useMutation({
    mutationFn: ({ weekNumber, year }: { weekNumber: number; year: number }) =>
      timeEntriesApi.validateWeek(weekNumber, year),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Semaine validée');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la validation');
    },
  });

  // Helper functions
  const getEntriesForDate = (date: Date) => {
    return timeEntries.filter((entry) => isSameDay(parseISO(entry.date), date));
  };

  const getTotalHoursForDate = (date: Date) => {
    return getEntriesForDate(date).reduce((sum, entry) => sum + entry.hours, 0);
  };

  const getTotalHoursForWeek = (weekNumber: number, year: number) => {
    return timeEntries
      .filter((entry) => entry.weekNumber === weekNumber && entry.year === year)
      .reduce((sum, entry) => sum + entry.hours, 0);
  };

  const isWeekValidated = (weekNumber: number, year: number) => {
    const weekEntries = timeEntries.filter(
      (entry) => entry.weekNumber === weekNumber && entry.year === year
    );
    return weekEntries.length > 0 && weekEntries.every((entry) => entry.validated);
  };

  const isHoliday = (date: Date) => {
    return holidays.some((h) => isSameDay(parseISO(h.date), date));
  };

  const getHolidayName = (date: Date) => {
    const holiday = holidays.find((h) => isSameDay(parseISO(h.date), date));
    return holiday?.name;
  };

  const isOnLeave = (date: Date) => {
    return leaves.some(
      (l) => l.userId === (selectedUserId || user?.id) && isSameDay(parseISO(l.date), date)
    );
  };

  const handleDayClick = (date: Date) => {
    if (isWeekend(date)) return;
    if (isOnLeave(date)) {
      toast.error('Vous êtes en congé ce jour');
      return;
    }

    setSelectedDate(date);
    setSelectedEntry(undefined);
    setModalOpen(true);
  };

  const handleSaveEntry = (data: { projectId: string; taskId: string; hours: number; description?: string }) => {
    if (!selectedDate) return;
    createEntryMutation.mutate({
      ...data,
      date: format(selectedDate, 'yyyy-MM-dd'),
    });
  };

  const handleValidateWeek = (weekNumber: number, year: number) => {
    validateWeekMutation.mutate({ weekNumber, year });
  };

  const goToPreviousMonth = () => {
    const { month, year } = getPreviousMonth(currentMonth, currentYear);
    setCurrentMonth(month);
    setCurrentYear(year);
  };

  const goToNextMonth = () => {
    const { month, year } = getNextMonth(currentMonth, currentYear);
    setCurrentMonth(month);
    setCurrentYear(year);
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(now.getMonth());
    setCurrentYear(now.getFullYear());
  };

  if (entriesLoading) {
    return <Spinner className="py-20" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Calendrier</h1>
          <p className="text-neutral-500">Pointez vos heures par projet et tâche</p>
        </div>

        {isAdmin && (
          <Select
            value={selectedUserId || ''}
            onChange={(e) => setSelectedUserId(e.target.value || undefined)}
            options={[
              { value: '', label: 'Tous les utilisateurs' },
              ...users.map((u) => ({
                value: u.id,
                label: `${u.firstName} ${u.lastName}`,
              })),
            ]}
            className="w-full sm:w-64"
          />
        )}
      </div>

      {/* Calendar controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToPreviousMonth}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-semibold text-neutral-900 min-w-[200px] text-center capitalize">
              {formatMonthYear(currentMonth, currentYear)}
            </h2>
            <Button variant="ghost" size="sm" onClick={goToNextMonth}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Aujourd'hui
          </Button>
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
          <span className="text-neutral-600">Jour férié</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-neutral-200" />
          <span className="text-neutral-600">Congé</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary-100 border border-primary-300" />
          <span className="text-neutral-600">Heures pointées</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-green-600" />
          <span className="text-neutral-600">Semaine validée</span>
        </div>
      </div>

      {/* Calendar grid */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-neutral-50">
                <th className="px-3 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider w-24">
                  Semaine
                </th>
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                  <th
                    key={day}
                    className="px-3 py-3 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wider"
                  >
                    {day}
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wider w-24">
                  Total
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {weeks.map((week) => {
                const weekTotal = getTotalHoursForWeek(week.weekNumber, week.year);
                const validated = isWeekValidated(week.weekNumber, week.year);

                return (
                  <tr key={`${week.year}-${week.weekNumber}`} className="hover:bg-neutral-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-700">S{week.weekNumber}</span>
                        {validated && <Lock className="w-3.5 h-3.5 text-green-600" />}
                      </div>
                    </td>
                    {week.days.map((day, dayIndex) => {
                      const isWeekendDay = isWeekend(day);
                      const holiday = isHoliday(day);
                      const holidayName = getHolidayName(day);
                      const onLeave = isOnLeave(day);
                      const dayHours = getTotalHoursForDate(day);
                      const isCurrentMonth = day.getMonth() === currentMonth;
                      const isToday = isSameDay(day, new Date());

                      return (
                        <td
                          key={dayIndex}
                          className={clsx(
                            'px-1 py-1 text-center',
                            !isCurrentMonth && 'bg-neutral-50'
                          )}
                        >
                          <button
                            onClick={() => !isWeekendDay && !validated && handleDayClick(day)}
                            disabled={isWeekendDay || validated}
                            className={clsx(
                              'w-full min-h-[60px] rounded-lg p-2 transition-all duration-200 relative',
                              isWeekendDay && 'bg-neutral-100 cursor-not-allowed',
                              holiday && 'bg-red-100 border border-red-300',
                              onLeave && !holiday && 'bg-neutral-200 cursor-not-allowed',
                              !isWeekendDay && !holiday && !onLeave && dayHours > 0 && 'bg-primary-50 border border-primary-200',
                              !isWeekendDay && !holiday && !onLeave && dayHours === 0 && !validated && 'hover:bg-primary-50 hover:border-primary-200 border border-transparent',
                              validated && 'cursor-not-allowed opacity-75',
                              isToday && 'ring-2 ring-primary-500'
                            )}
                            title={holidayName}
                          >
                            <div className={clsx(
                              'text-xs font-medium',
                              !isCurrentMonth ? 'text-neutral-400' : 'text-neutral-700',
                              isToday && 'text-primary-600'
                            )}>
                              {format(day, 'd')}
                            </div>
                            {dayHours > 0 && (
                              <div className="mt-1 text-sm font-semibold text-primary-600">
                                {dayHours}h
                              </div>
                            )}
                            {holiday && (
                              <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                                <AlertCircle className="w-3 h-3 text-red-500" />
                              </div>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <div className={clsx(
                        'text-lg font-bold',
                        weekTotal > 0 ? 'text-primary-600' : 'text-neutral-400'
                      )}>
                        {weekTotal}h
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {!validated && weekTotal > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleValidateWeek(week.weekNumber, week.year)}
                          isLoading={validateWeekMutation.isPending}
                        >
                          <Check className="w-4 h-4" />
                          Valider
                        </Button>
                      )}
                      {validated && (
                        <Badge variant="success">
                          <Lock className="w-3 h-3 mr-1" />
                          Validée
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Time Entry Modal */}
      <TimeEntryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        date={selectedDate || new Date()}
        existingEntry={selectedEntry}
        projects={projects}
        onSave={handleSaveEntry}
        isLoading={createEntryMutation.isPending}
      />
    </div>
  );
};
