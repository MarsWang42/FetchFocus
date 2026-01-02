import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CompletedTask } from '@/lib/types';
import { storage } from '@/lib/storage';

interface CalendarViewProps {
    className?: string;
}

function CalendarView({ className }: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [tasks, setTasks] = useState<CompletedTask[]>([]);
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Load tasks for current month
    useEffect(() => {
        const loadTasks = async () => {
            const startOfMonth = new Date(year, month, 1);
            const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
            const monthTasks = await storage.getCompletedTasksInRange(startOfMonth, endOfMonth);
            setTasks(monthTasks);
        };
        loadTasks();
    }, [year, month]);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    const prevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
        setSelectedDay(null);
    };

    const nextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
        setSelectedDay(null);
    };

    const getTasksForDay = useCallback((day: number) => {
        const dayStart = new Date(year, month, day).getTime();
        const dayEnd = new Date(year, month, day, 23, 59, 59).getTime();
        return tasks.filter(t => t.completedAt >= dayStart && t.completedAt <= dayEnd);
    }, [tasks, year, month]);

    const isToday = (day: number) => {
        const today = new Date();
        return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    };

    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const selectedDayTasks = selectedDay
        ? getTasksForDay(selectedDay.getDate())
        : [];

    return (
        <div className={className}>
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="text-lg font-semibold text-slate-800">{monthName}</h3>
                <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-slate-500 py-1">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for days before month starts */}
                {Array.from({ length: firstDayOfMonth }, (_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dayTasks = getTasksForDay(day);
                    const hasTask = dayTasks.length > 0;
                    const isSelected = selectedDay?.getDate() === day && selectedDay?.getMonth() === month;

                    return (
                        <button
                            key={day}
                            onClick={() => setSelectedDay(new Date(year, month, day))}
                            className={`
                aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all
                ${isToday(day) ? 'ring-2 ring-amber-400' : ''}
                ${isSelected ? 'bg-amber-500 text-white' : 'hover:bg-amber-100'}
                ${hasTask ? 'font-semibold' : 'text-slate-600'}
              `}
                        >
                            <span>{day}</span>
                            {hasTask && (
                                <div className={`flex gap-0.5 mt-0.5 ${isSelected ? '' : ''}`}>
                                    {Array.from({ length: Math.min(dayTasks.length, 3) }, (_, j) => (
                                        <div
                                            key={j}
                                            className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/80' : 'bg-amber-500'}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Selected Day Details */}
            {selectedDay && (
                <div className="mt-4 p-4 bg-white rounded-lg shadow-sm border border-amber-100">
                    <h4 className="font-semibold text-slate-800 mb-2">
                        {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </h4>
                    {selectedDayTasks.length > 0 ? (
                        <ul className="space-y-2">
                            {selectedDayTasks.map(task => (
                                <li key={task.id} className="flex items-center gap-2 text-sm text-slate-700">
                                    <span className="text-amber-500">✓</span>
                                    <span>{task.taskName}</span>
                                    {task.focusDurationMs && (
                                        <span className="text-slate-400 text-xs">
                                            ({Math.round(task.focusDurationMs / 60000)}min)
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-slate-400 italic">No tasks completed this day</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default CalendarView;
