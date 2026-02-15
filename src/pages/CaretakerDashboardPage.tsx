import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
    Pill,
    Clock,
    TrendingUp,
    AlertCircle,
    LogOut,
    Bell,
    User,
    Mail,
    Calendar as CalendarIcon,
    Loader2,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { cn } from "../utils/cn";
import { emailService } from "../services/emailService";

interface Medication {
    id: string;
    name: string;
    dosage: string;
    start_date: string;
    duration_type: 'days' | 'lifetime';
    duration_days: number | null;
    schedules: { id: string; time: string }[];
}

interface MedicationLog {
    id?: string;
    schedule_id: string;
    status: 'taken' | 'missed';
    taken_at: string | null;
    date: string;
    medication_name?: string;
}

interface NotificationSettings {
    emailNotifications: boolean;
    missedAlerts: boolean;
    alertThresholdHours: number;
    dailyReminderTime: string;
    emailAddress: string;
}

export default function CaretakerDashboardPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [medications, setMedications] = useState<Medication[]>([]);
    const [dailyLogs, setDailyLogs] = useState<Record<string, MedicationLog>>({});
    const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'calendar' | 'notifications'>('overview');
    const [stats, setStats] = useState({
        adherenceRate: 85,
        streak: 5,
        missedThisMonth: 0,
        takenThisMonth: 0,
        remainingThisMonth: 0,
        takenThisWeek: 4
    });
    const [sendingEmail, setSendingEmail] = useState(false);
    const [caretakerEmail, setCaretakerEmail] = useState<string>("");
    const [historicalLogs, setHistoricalLogs] = useState<MedicationLog[]>([]);
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
        emailNotifications: true,
        missedAlerts: true,
        alertThresholdHours: 1,
        dailyReminderTime: "08:00 AM",
        emailAddress: ""
    });
    const [savingSettings, setSavingSettings] = useState(false);
    const [calendarViewDate, setCalendarViewDate] = useState(new Date());
    const [monthlyCalendarLogs, setMonthlyCalendarLogs] = useState<Record<string, { status: 'taken' | 'missed'; medication_name?: string }[]>>({});
    const [patientName, setPatientName] = useState("Eleanor Thompson");

    const today = new Date().toLocaleDateString('en-CA');

    useEffect(() => {
        fetchData();
        fetchCalendarLogs();
    }, [calendarViewDate]);

    const fetchCalendarLogs = async () => {
        try {
            const startOfMonth = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), 1).toLocaleDateString('en-CA');
            const endOfMonth = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 0).toLocaleDateString('en-CA');

            const { data: logs, error } = await supabase
                .from('medication_logs')
                .select(`
                    status, 
                    date,
                    medication_schedules(medications(name))
                `)
                .gte('date', startOfMonth)
                .lte('date', endOfMonth);

            if (error) throw error;

            const logsByDate: Record<string, { status: 'taken' | 'missed'; medication_name?: string }[]> = {};
            const uniqueTakenDates = new Set<string>();
            const uniqueMissedDates = new Set<string>();

            logs?.forEach(log => {
                if (!logsByDate[log.date]) {
                    logsByDate[log.date] = [];
                }
                logsByDate[log.date].push({
                    status: log.status as 'taken' | 'missed',
                    medication_name: (log.medication_schedules as any)?.medications?.name
                });

                if (log.status === 'taken') uniqueTakenDates.add(log.date);
                if (log.status === 'missed') uniqueMissedDates.add(log.date);
            });
            setMonthlyCalendarLogs(logsByDate);

            setStats(prev => ({
                ...prev,
                takenThisMonth: uniqueTakenDates.size,
                missedThisMonth: uniqueMissedDates.size,
            }));
        } catch (err) {
            console.error("Error fetching monthly calendar logs:", err);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate("/login");
                return;
            }
            setCaretakerEmail(user.email || "");

            // Fetch patient profile name
            const { data: profile } = await supabase
                .from('profiles')
                .select('patient_name')
                .eq('id', user.id)
                .single();

            if (profile?.patient_name) {
                setPatientName(profile.patient_name);
            }

            // Fetch medications (assuming for now the caretaker sees all medications they manage)
            // In a real app, there would be a patient-link table. For now, we'll fetch all.
            const { data: meds, error: medsError } = await supabase
                .from('medications')
                .select(`
                    id, name, dosage, start_date, duration_type, duration_days,
                    schedules:medication_schedules(id, time)
                `);

            if (medsError) throw medsError;
            setMedications(meds || []);

            // Fetch today's logs
            const { data: logs, error: logsError } = await supabase
                .from('medication_logs')
                .select('schedule_id, status, taken_at, date')
                .eq('date', today);

            if (logsError) throw logsError;

            const logsMap: Record<string, MedicationLog> = {};
            logs?.forEach(log => {
                logsMap[log.schedule_id] = log;
            });
            setDailyLogs(logsMap);

            // Fetch historical logs (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: history, error: historyError } = await supabase
                .from('medication_logs')
                .select(`
                    schedule_id, 
                    status, 
                    taken_at, 
                    date,
                    medication_schedules(medication_id, medications(name))
                `)
                .gte('date', thirtyDaysAgo.toLocaleDateString('en-CA'))
                .order('date', { ascending: false });

            if (historyError) throw historyError;

            const formattedHistory = (history || []).map(h => ({
                schedule_id: h.schedule_id,
                status: h.status as 'taken' | 'missed',
                taken_at: h.taken_at,
                date: h.date,
                medication_name: (h.medication_schedules as any)?.medications?.name
            }));

            setHistoricalLogs(formattedHistory);

            // Fetch Notification Settings from User Metadata
            const settings = (user.user_metadata as any)?.notificationSettings || {
                emailNotifications: true,
                missedAlerts: true,
                alertThresholdHours: 1,
                dailyReminderTime: "08:00 AM",
                emailAddress: user.email || ""
            };
            setNotificationSettings(settings);

            // Calculate real stats
            calculateStats(meds || [], logs || []);

        } catch (err) {
            console.error("Error fetching caretaker dashboard data:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        try {
            setSavingSettings(true);
            const { error } = await supabase.auth.updateUser({
                data: { notificationSettings }
            });
            if (error) throw error;
            alert("Settings saved successfully!");
        } catch (err) {
            console.error("Failed to save settings:", err);
            alert("Failed to save settings. Please try again.");
        } finally {
            setSavingSettings(false);
        }
    };

    const calculateStats = (meds: Medication[], logs: MedicationLog[]) => {
        const totalSchedules = meds.reduce((acc, med) => acc + med.schedules.length, 0);
        const takenToday = logs.filter(log => log.status === 'taken').length;

        const adherence = totalSchedules > 0 ? Math.round((takenToday / totalSchedules) * 100) : 100;

        // Calculate remaining days based on medication course duration
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let maxRemainingDays = 0;
        let isLifetime = false;
        meds.forEach(med => {
            if (med.duration_type === 'lifetime') {
                isLifetime = true;
            } else if (med.start_date && med.duration_days) {
                // Split date string and create a local date to avoid timezone shifts
                const [year, month, day] = med.start_date.split('-').map(Number);
                const startDate = new Date(year, month - 1, day);
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + med.duration_days);

                const diffTime = endDate.getTime() - today.getTime();
                let diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                // Check if all doses for this medication are taken today
                const medScheduleIds = new Set(med.schedules.map(s => s.id));
                const medTakenToday = logs.filter(l => l.schedule_id && medScheduleIds.has(l.schedule_id) && l.status === 'taken').length;
                const isFullyTakenToday = med.schedules.length > 0 && medTakenToday >= med.schedules.length;

                if (isFullyTakenToday && diffDays > 0) {
                    diffDays -= 1;
                }

                if (diffDays > maxRemainingDays) {
                    maxRemainingDays = diffDays;
                }
            }
        });

        setStats(prev => ({
            ...prev,
            adherenceRate: adherence,
            takenThisWeek: takenToday,
            remainingThisMonth: isLifetime ? 999 : (maxRemainingDays > 0 ? maxRemainingDays : 0)
        }));
    };

    const handleSendReminder = async () => {
        if (!caretakerEmail) return;

        if (!notificationSettings.emailNotifications) {
            alert("Email notifications are currently disabled in your settings.");
            return;
        }

        try {
            setSendingEmail(true);
            await emailService.sendReminder(
                caretakerEmail,
                patientName,
                "Daily Medication Set"
            );
            alert("Reminder email sent to your inbox!");
        } catch (err) {
            console.error("Failed to send reminder:", err);
            alert("Failed to send reminder email. Please try again.");
        } finally {
            setSendingEmail(false);
        }
    };

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            navigate("/login");
        } catch (err) {
            console.error("Logout error:", err);
            alert("Failed to log out. Please try again.");
        }
    };

    const handlePrevMonth = () => {
        setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-xl text-white">
                            <Pill className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 leading-none">Medicare Companion</h1>
                            <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wider">Monitoring: {patientName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => navigate('/patient-dashboard')}>
                            Switch to Patient
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-destructive transition-colors gap-2"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-5 w-5" />
                            <span className="font-semibold">Log out</span>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Hero Stats */}
                <div className="rounded-[2rem] bg-gradient-to-br from-emerald-500 via-blue-600 to-indigo-600 p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-200">
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-sm">
                                <User className="h-10 w-10" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black">{patientName}'s Dashboard</h2>
                                <p className="text-blue-50/80 font-medium">Monitoring medication adherence</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full md:w-auto">
                            {[
                                { label: 'Adherence Rate', value: `${stats.adherenceRate}%` },
                                { label: 'Current Streak', value: stats.streak },
                                { label: 'Missed This Month', value: stats.missedThisMonth },
                                { label: 'Taken This Week', value: stats.takenThisWeek },
                            ].map((s, idx) => (
                                <div key={idx} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center min-w-[120px]">
                                    <p className="text-3xl font-black">{s.value}</p>
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-blue-100">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 w-full overflow-x-auto no-scrollbar">
                    {['overview', 'activity', 'calendar', 'notifications'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={cn(
                                "flex-1 py-3 px-6 rounded-xl text-sm font-bold capitalize transition-all whitespace-nowrap",
                                activeTab === tab
                                    ? "bg-blue-50 text-blue-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-[#1e293b]">
                    {/* Content Area */}
                    <div className="lg:col-span-2 space-y-8">
                        {activeTab === 'overview' && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 px-2">
                                    <CalendarIcon className="h-5 w-5 text-blue-600" />
                                    <h3 className="text-xl font-bold text-slate-800">Today's Status</h3>
                                </div>

                                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                                    <CardContent className="p-6">
                                        {medications.length === 0 ? (
                                            <p className="text-center text-slate-500 py-8">No medication schedules found for today.</p>
                                        ) : (
                                            <div className="space-y-4">
                                                {medications.map(med => (
                                                    med.schedules.map(schedule => {
                                                        const log = dailyLogs[schedule.id];
                                                        const isTaken = !!log;
                                                        // Check if missed (> 1 hour)
                                                        const [hours, minutes] = schedule.time.split(':').map(Number);
                                                        const scheduledTime = new Date();
                                                        scheduledTime.setHours(hours, minutes, 0, 0);
                                                        const now = new Date();
                                                        const isCritical = !isTaken && (now.getTime() - scheduledTime.getTime() > 3600000);

                                                        return (
                                                            <div key={schedule.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group">
                                                                <div className="flex items-center gap-4">
                                                                    <div className={cn(
                                                                        "p-3 rounded-xl",
                                                                        isTaken ? "bg-emerald-100 text-emerald-600" : "bg-white text-slate-400"
                                                                    )}>
                                                                        <Pill className="h-5 w-5" />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-bold">{med.name}</h4>
                                                                        <p className="text-sm text-slate-500 font-medium flex items-center gap-1">
                                                                            <Clock className="h-3 w-3" />
                                                                            {schedule.time.slice(0, 5)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    {isCritical && (
                                                                        <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-tighter text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full animate-pulse">
                                                                            <AlertCircle className="h-3.5 w-3.5" />
                                                                            Critical Miss
                                                                        </span>
                                                                    )}
                                                                    <div className={cn(
                                                                        "px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest",
                                                                        isTaken ? "bg-emerald-500 text-white" : "bg-orange-500 text-white"
                                                                    )}>
                                                                        {isTaken ? 'Taken' : 'Pending'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <div className="space-y-4">
                                    <h3 className="text-xl font-bold text-slate-800 px-2">Monthly Adherence Progress</h3>
                                    <Card className="border-none shadow-sm ring-1 ring-slate-100">
                                        <CardContent className="p-8 space-y-6">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-bold text-slate-600 uppercase tracking-widest">Overall Progress</span>
                                                <span className="text-sm font-black text-slate-900">{stats.adherenceRate}%</span>
                                            </div>
                                            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-600 transition-all duration-1000"
                                                    style={{ width: `${stats.adherenceRate}%` }}
                                                />
                                            </div>
                                            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-50">
                                                <div className="text-center">
                                                    <p className="text-xl font-black text-emerald-600">{stats.takenThisMonth} days</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Taken</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xl font-black text-rose-500">{stats.missedThisMonth} days</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Missed</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xl font-black text-blue-500">
                                                        {stats.remainingThisMonth === 999 ? '∞' : `${stats.remainingThisMonth} days`}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remaining</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}
                        {activeTab === 'activity' && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 px-2">
                                    <Clock className="h-5 w-5 text-blue-600" />
                                    <h3 className="text-xl font-bold text-slate-800">Recent Medication Activity</h3>
                                </div>
                                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                                    <CardContent className="p-0">
                                        <div className="divide-y divide-slate-100">
                                            {historicalLogs.length === 0 ? (
                                                <p className="p-8 text-center text-slate-500 font-medium">No activity recorded in the last 30 days.</p>
                                            ) : (
                                                historicalLogs.map((log, idx) => (
                                                    <div key={idx} className="p-6 hover:bg-slate-50/50 transition-colors flex items-center justify-between">
                                                        <div className="flex items-center gap-5">
                                                            <div className={cn(
                                                                "h-12 w-12 rounded-2xl flex items-center justify-center",
                                                                log.status === 'taken' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                                                            )}>
                                                                {log.status === 'taken' ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-slate-900">
                                                                    {log.date && typeof log.date === 'string' ? new Date(log.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Unknown Date'}
                                                                </h4>
                                                                <p className="text-sm text-slate-500 font-medium mt-0.5">
                                                                    {log.medication_name} • {log.status === 'taken' && log.taken_at && typeof log.taken_at === 'string' ? `Taken at ${new Date(log.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Dose missed'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className={cn(
                                                            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                                                            log.status === 'taken' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                        )}>
                                                            {log.status === 'taken' ? 'Completed' : 'Missed'}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {activeTab === 'calendar' && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 px-2">
                                    <CalendarIcon className="h-5 w-5 text-blue-600" />
                                    <h3 className="text-xl font-bold text-slate-800">Medication Calendar Overview</h3>
                                </div>
                                <Card className="border-none shadow-sm ring-1 ring-slate-100 p-8">
                                    <div className="flex items-center justify-between mb-8 px-2">
                                        <button
                                            onClick={handlePrevMonth}
                                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                                        >
                                            <ChevronLeft className="h-6 w-6" />
                                        </button>
                                        <h4 className="text-lg font-bold text-slate-800">
                                            {calendarViewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                        </h4>
                                        <button
                                            onClick={handleNextMonth}
                                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                                        >
                                            <ChevronRight className="h-6 w-6" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest gap-y-8">
                                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}

                                        {(() => {
                                            const year = calendarViewDate.getFullYear();
                                            const month = calendarViewDate.getMonth();
                                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                                            const firstDayOfMonth = new Date(year, month, 1).getDay();

                                            const elements = [];

                                            for (let i = 0; i < firstDayOfMonth; i++) {
                                                elements.push(<div key={`empty-${i}`} />);
                                            }

                                            for (let day = 1; day <= daysInMonth; day++) {
                                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                const isToday = dateStr === today;
                                                const dayLogs = monthlyCalendarLogs[dateStr] || [];

                                                const hasTaken = dayLogs.some(l => l.status === 'taken');
                                                const hasMissed = dayLogs.some(l => l.status === 'missed');

                                                elements.push(
                                                    <div key={day} className="relative flex flex-col items-center group cursor-help">
                                                        <div className={cn(
                                                            "h-10 w-10 rounded-2xl flex items-center justify-center text-sm font-black transition-all",
                                                            isToday ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-100",
                                                            hasTaken && !isToday && "bg-emerald-50 text-emerald-600 ring-2 ring-emerald-100",
                                                            hasMissed && !isToday && "bg-rose-50 text-rose-600 ring-2 ring-rose-100"
                                                        )}>
                                                            {day}
                                                        </div>
                                                        {dayLogs.length > 0 && (
                                                            <div className="absolute top-12 opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-[10px] py-1 px-2 rounded-lg pointer-events-none transition-opacity whitespace-nowrap z-50">
                                                                {dayLogs.map((l, idx) => (
                                                                    <div key={idx}>{l.medication_name}: {l.status}</div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            return elements;
                                        })()}
                                    </div>
                                    <div className="mt-12 pt-8 border-t border-slate-50 flex flex-wrap gap-8 justify-center">
                                        <div className="flex items-center gap-3">
                                            <div className="h-4 w-4 rounded-lg bg-emerald-100 ring-2 ring-emerald-200" />
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Medication Taken</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="h-4 w-4 rounded-lg bg-rose-100 ring-2 ring-rose-200" />
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Missed Medication</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="h-4 w-4 rounded-lg bg-blue-600 shadow-md shadow-blue-100" />
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Today</span>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 px-2">
                                    <Bell className="h-5 w-5 text-blue-600" />
                                    <h3 className="text-xl font-bold text-slate-800">Notification Preferences</h3>
                                </div>
                                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                                    <CardContent className="p-8 space-y-10">
                                        {/* Toggles */}
                                        {[
                                            { id: 'emailNotifications', label: 'Email Notifications', desc: 'Receive medication alerts via email' },
                                            { id: 'missedAlerts', label: 'Missed Medication Alerts', desc: 'Get notified when medication is not taken on time' }
                                        ].map(item => (
                                            <div key={item.id} className="flex items-center justify-between group">
                                                <div className="space-y-1">
                                                    <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{item.label}</h4>
                                                    <p className="text-sm text-slate-500 font-medium">{item.desc}</p>
                                                </div>
                                                <button
                                                    onClick={() => setNotificationSettings(prev => ({ ...prev, [item.id]: !prev[item.id as keyof NotificationSettings] }))}
                                                    className={cn(
                                                        "h-8 w-14 rounded-full p-1 transition-all duration-300 relative",
                                                        notificationSettings[item.id as keyof NotificationSettings] ? "bg-blue-600" : "bg-slate-200"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "h-6 w-6 bg-white rounded-full shadow-sm transition-all duration-300",
                                                        notificationSettings[item.id as keyof NotificationSettings] ? "translate-x-6" : "translate-x-0"
                                                    )} />
                                                </button>
                                            </div>
                                        ))}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-50">
                                            <div className="space-y-3">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Alert Threshold</label>
                                                <select
                                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl h-14 px-4 font-bold text-slate-700 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                                                    value={notificationSettings.alertThresholdHours}
                                                    onChange={e => setNotificationSettings(p => ({ ...p, alertThresholdHours: Number(e.target.value) }))}
                                                >
                                                    <option value={1}>1 Hour After Miss</option>
                                                    <option value={2}>2 Hours After Miss</option>
                                                    <option value={3}>3 Hours After Miss</option>
                                                </select>
                                                <p className="text-[10px] text-slate-400 font-bold px-1 uppercase tracking-tighter">Time to wait before sending critical alert</p>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Daily Reminder Time</label>
                                                <input
                                                    type="time"
                                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl h-14 px-4 font-bold text-slate-700 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                                                    value={notificationSettings.dailyReminderTime}
                                                    onChange={e => setNotificationSettings(p => ({ ...p, dailyReminderTime: e.target.value }))}
                                                />
                                                <p className="text-[10px] text-slate-400 font-bold px-1 uppercase tracking-tighter">Time to check if today's medication was taken</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Notification Email Address</label>
                                            <div className="relative">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                                <input
                                                    type="email"
                                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl h-14 pl-12 pr-4 font-bold text-slate-700 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                                                    placeholder="caretaker@example.com"
                                                    value={notificationSettings.emailAddress}
                                                    onChange={e => setNotificationSettings(p => ({ ...p, emailAddress: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        <Button
                                            className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-blue-600 text-white font-black uppercase tracking-widest shadow-xl shadow-slate-200 transition-all active:scale-[0.98]"
                                            onClick={handleSaveSettings}
                                            disabled={savingSettings}
                                        >
                                            {savingSettings ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "Save Notification Preferences"}
                                        </Button>
                                    </CardContent>
                                </Card>

                                {/* Email Preview */}
                                <div className="space-y-4 pt-4">
                                    <h3 className="text-lg font-bold text-slate-800 px-2 flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-blue-600" />
                                        Email Preview
                                    </h3>
                                    <Card className="border-none shadow-sm ring-1 ring-slate-100 bg-white/50 overflow-hidden">
                                        <CardContent className="p-8">
                                            <div className="space-y-4">
                                                <div className="flex gap-2">
                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Subject:</span>
                                                    <span className="text-xs font-bold text-slate-700">Medication Alert - {patientName}</span>
                                                </div>
                                                <div className="border-t border-slate-100 pt-4 space-y-3">
                                                    <p className="text-xs text-slate-600 leading-relaxed font-medium">Hello,</p>
                                                    <p className="text-xs text-slate-600 leading-relaxed font-medium">This is a reminder that {patientName} has not taken her medication today.</p>
                                                    <p className="text-xs text-slate-600 leading-relaxed font-medium">Please check with her to ensure she takes her prescribed medication.</p>
                                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest pt-4">Current adherence rate: {stats.adherenceRate}% (5-day streak)</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-8">
                        <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden text-[#1e293b]">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                                <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3 pt-6">
                                <Button
                                    className="w-full justify-start gap-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 h-12 rounded-xl group"
                                    variant="outline"
                                    onClick={handleSendReminder}
                                    disabled={sendingEmail}
                                >
                                    {sendingEmail ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                    ) : (
                                        <Mail className="h-4 w-4 text-blue-500 transition-transform group-hover:scale-110" />
                                    )}
                                    {sendingEmail ? "Sending..." : "Send Reminder Email"}
                                </Button>
                                <Button
                                    className="w-full justify-start gap-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 h-12 rounded-xl group"
                                    variant="outline"
                                    onClick={() => setActiveTab('notifications')}
                                >
                                    <Bell className="h-4 w-4 text-orange-500 transition-transform group-hover:scale-110" />
                                    Configure Notifications
                                </Button>
                                <Button
                                    className="w-full justify-start gap-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 h-12 rounded-xl group"
                                    variant="outline"
                                    onClick={() => setActiveTab('calendar')}
                                >
                                    <CalendarIcon className="h-4 w-4 text-emerald-500 transition-transform group-hover:scale-110" />
                                    View Full Calendar
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Tip Card */}
                        <div className="bg-blue-600 rounded-[2rem] p-8 text-white shadow-xl shadow-blue-200 relative overflow-hidden group">
                            <TrendingUp className="absolute -right-8 -bottom-8 h-48 w-48 opacity-10 group-hover:scale-110 transition-transform duration-500" />
                            <h4 className="text-xl font-black mb-2">Did you know?</h4>
                            <p className="text-blue-50 text-sm leading-relaxed font-medium">
                                Regular care visits combined with digital monitoring can improve medication adherence by up to 40%.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
