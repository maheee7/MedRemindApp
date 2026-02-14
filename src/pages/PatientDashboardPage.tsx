import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Pill, Clock, CheckCircle2, TrendingUp, Calendar as CalendarIcon, LogOut, ChevronLeft, ChevronRight, AlertCircle, Loader2, Camera, X } from "lucide-react";
import { cn } from "../utils/cn";

interface Medication {
    id: string;
    name: string;
    dosage: string;
    duration_type: string;
    schedules: {
        id: string;
        time: string;
    }[];
}

interface MedicationLog {
    schedule_id: string;
    status: 'taken' | 'missed';
    taken_at: string;
    photo_url?: string;
}

export default function PatientDashboardPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [medications, setMedications] = useState<Medication[]>([]);
    const [dailyLogs, setDailyLogs] = useState<Record<string, MedicationLog>>({});
    const [pendingPhotos, setPendingPhotos] = useState<Record<string, File>>({});
    const [uploading, setUploading] = useState<string | null>(null);
    const [stats, setStats] = useState({
        streak: 0,
        dailyProgress: 0,
        monthlyRate: 0
    });
    const [viewDate, setViewDate] = useState(new Date());
    const [monthlyLogs, setMonthlyLogs] = useState<Record<string, { status: 'taken' | 'missed' }[]>>({});

    const today = new Date().toLocaleDateString('en-CA');

    useEffect(() => {
        fetchData();
        fetchMonthlyLogs();
    }, [viewDate]);

    const fetchMonthlyLogs = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).toLocaleDateString('en-CA');
            const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).toLocaleDateString('en-CA');

            const { data: logs, error } = await supabase
                .from('medication_logs')
                .select('date, status')
                .eq('user_id', user.id)
                .gte('date', startOfMonth)
                .lte('date', endOfMonth);

            if (error) throw error;

            const logsByDate: Record<string, { status: 'taken' | 'missed' }[]> = {};
            logs?.forEach(log => {
                if (!logsByDate[log.date]) {
                    logsByDate[log.date] = [];
                }
                logsByDate[log.date].push({ status: log.status });
            });
            setMonthlyLogs(logsByDate);
        } catch (err) {
            console.error("Error fetching monthly logs:", err);
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

            // Fetch medications with schedules that have started
            const { data: meds, error: medsError } = await supabase
                .from('medications')
                .select(`
                    id, name, dosage, duration_type,
                    schedules:medication_schedules(id, time)
                `)
                .eq('user_id', user.id)
                .lte('start_date', today);

            if (medsError) throw medsError;
            setMedications(meds || []);

            // Fetch today's logs
            const { data: logs, error: logsError } = await supabase
                .from('medication_logs')
                .select('schedule_id, status, taken_at')
                .eq('user_id', user.id)
                .eq('date', today);

            if (logsError) throw logsError;

            const logsMap: Record<string, MedicationLog> = {};
            logs?.forEach(log => {
                logsMap[log.schedule_id] = log;
            });
            setDailyLogs(logsMap);

            // Calculate stats
            calculateStats(meds || [], logs || []);

        } catch (err) {
            console.error("Error fetching dashboard data:", err);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (meds: Medication[], logs: any[]) => {
        const totalSchedules = meds.reduce((acc, med) => acc + med.schedules.length, 0);
        const completedSchedules = logs.filter(l => l.status === 'taken').length;

        setStats({
            dailyProgress: totalSchedules > 0 ? Math.round((completedSchedules / totalSchedules) * 100) : 0,
            streak: 5, // Mock streak for UI
            monthlyRate: 94 // Mock monthly rate for UI
        });
    };

    const handlePhotoChange = (scheduleId: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setPendingPhotos(prev => ({ ...prev, [scheduleId]: file }));
        }
    };

    const handleRemovePhoto = (scheduleId: string) => {
        setPendingPhotos(prev => {
            const next = { ...prev };
            delete next[scheduleId];
            return next;
        });
    };

    const handleMarkAsTaken = async (medicationId: string, scheduleId: string) => {
        try {
            setUploading(scheduleId);

            // 1. Get user directly to ensure fresh auth state
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
            if (authError || !authUser) throw new Error("Authentication required. Please log in again.");

            let photo_url = undefined;

            // 2. Upload photo if present
            const pendingPhoto = pendingPhotos[scheduleId];
            if (pendingPhoto) {
                const fileExt = pendingPhoto.name.split('.').pop();
                const fileName = `${authUser.id}/${today}/${scheduleId}_${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('medication-proofs')
                    .upload(fileName, pendingPhoto);

                if (uploadError) {
                    console.error("Storage upload error:", uploadError);
                    throw new Error(`Failed to upload photo: ${uploadError.message}`);
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('medication-proofs')
                    .getPublicUrl(fileName);

                photo_url = publicUrl;
            }

            // 3. Insert log
            const { error: logError } = await supabase
                .from('medication_logs')
                .insert([{
                    medication_id: medicationId,
                    schedule_id: scheduleId,
                    user_id: authUser.id,
                    date: today,
                    status: 'taken',
                    taken_at: new Date().toISOString(),
                    photo_url: photo_url
                }]);

            if (logError) {
                console.error("Database log error:", logError);
                if (logError.code === '23505') {
                    throw new Error("This dose has already been marked as taken.");
                }
                throw new Error(`Failed to save log: ${logError.message}`);
            }

            // Clear pending photo
            handleRemovePhoto(scheduleId);

            // Refresh data
            fetchData();
        } catch (err: any) {
            console.error("Error in handleMarkAsTaken:", err);
            alert(err.message || "An unexpected error occurred.");
        } finally {
            setUploading(null);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
    };

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
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

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
                    <p className="text-slate-500 font-medium">Loading your dashboard...</p>
                </div>
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
                            <h1 className="text-lg font-bold text-slate-900 leading-none">MediCare Companion</h1>
                            <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wider">Patient View</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="sm" className="hidden sm:flex text-slate-600 font-semibold" onClick={() => navigate('/caretaker-dashboard')}>
                            Switch to Caretaker
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
                {/* Hero Stats Section */}
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-600 via-indigo-600 to-emerald-500 p-1 sm:p-1.5 shadow-2xl shadow-blue-200">
                    <div className="bg-white/10 backdrop-blur-md rounded-[1.9rem] p-6 sm:p-10 text-white relative">
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <TrendingUp className="h-48 w-48" />
                        </div>

                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                            <div className="space-y-2">
                                <p className="text-blue-100 font-semibold text-lg">{getGreeting()}!</p>
                                <h2 className="text-4xl sm:text-5xl font-black tracking-tight">Ready to stay on track?</h2>
                                <p className="text-blue-100/80 max-w-md font-medium">
                                    You've completed {stats.dailyProgress}% of your medication for today. Great job!
                                </p>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 w-full md:w-auto">
                                <div className="bg-white/10 p-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center">
                                    <span className="text-3xl font-black">{stats.streak}</span>
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-blue-100 mb-1">Day Streak</span>
                                </div>
                                <div className="bg-white/10 p-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center">
                                    <span className="text-3xl font-black">{stats.dailyProgress}%</span>
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-blue-100 mb-1">Today's Status</span>
                                </div>
                                <div className="bg-emerald-400/20 p-4 rounded-2xl border border-emerald-400/20 flex flex-col items-center justify-center text-center hidden lg:flex">
                                    <span className="text-3xl font-black text-emerald-300">{stats.monthlyRate}%</span>
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-100 mb-1">Monthly Rate</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Medication List */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-blue-600" />
                                <h3 className="text-xl font-bold text-slate-800">Today's Medication</h3>
                            </div>
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-tighter">
                                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>

                        {medications.length === 0 ? (
                            <Card className="border-2 border-dashed border-slate-200 shadow-none bg-slate-50/50">
                                <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                                    <div className="bg-white p-4 rounded-full shadow-sm">
                                        <AlertCircle className="h-8 w-8 text-slate-300" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-600 font-bold text-lg">No medications found</p>
                                        <p className="text-slate-400 text-sm max-w-xs mx-auto">
                                            Please contact your caretaker to add your medication schedule.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                {medications.map(med => (
                                    med.schedules.map(schedule => {
                                        const isTaken = !!dailyLogs[schedule.id];
                                        return (
                                            <Card
                                                key={schedule.id}
                                                className={cn(
                                                    "transition-all duration-300 border-none shadow-sm hover:shadow-md",
                                                    isTaken ? "bg-emerald-50/50 ring-1 ring-emerald-100" : "bg-white ring-1 ring-slate-100"
                                                )}
                                            >
                                                <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={cn(
                                                            "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors",
                                                            isTaken ? "bg-emerald-100 text-emerald-600" : "bg-blue-50 text-blue-600"
                                                        )}>
                                                            <Pill className="h-6 w-6" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-slate-900">{med.name}</h4>
                                                            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                                                                <span>{med.dosage}</span>
                                                                <span className="h-1 w-1 bg-slate-300 rounded-full" />
                                                                <div className="flex items-center text-blue-600 font-bold">
                                                                    <Clock className="h-3.5 w-3.5 mr-1" />
                                                                    {schedule.time.slice(0, 5)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row items-center gap-3">
                                                        {!isTaken && (
                                                            <div className="relative">
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    capture="environment"
                                                                    className="hidden"
                                                                    id={`photo-${schedule.id}`}
                                                                    onChange={(e) => handlePhotoChange(schedule.id, e)}
                                                                />
                                                                {pendingPhotos[schedule.id] ? (
                                                                    <div className="relative group">
                                                                        <img
                                                                            src={URL.createObjectURL(pendingPhotos[schedule.id])}
                                                                            alt="Preview"
                                                                            className="h-11 w-11 rounded-xl object-cover ring-2 ring-blue-100"
                                                                        />
                                                                        <button
                                                                            onClick={() => handleRemovePhoto(schedule.id)}
                                                                            className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => document.getElementById(`photo-${schedule.id}`)?.click()}
                                                                        className="h-11 w-11 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                                    >
                                                                        <Camera className="h-5 w-5" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        )}
                                                        <Button
                                                            onClick={() => !isTaken && handleMarkAsTaken(med.id, schedule.id)}
                                                            disabled={isTaken || uploading === schedule.id}
                                                            className={cn(
                                                                "rounded-xl font-bold h-11 px-6 transition-all transform",
                                                                isTaken
                                                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 cursor-default"
                                                                    : "bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm active:scale-95"
                                                            )}
                                                        >
                                                            {uploading === schedule.id ? (
                                                                <span className="flex items-center">
                                                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                                                    Uploading...
                                                                </span>
                                                            ) : isTaken ? (
                                                                <span className="flex items-center">
                                                                    <CheckCircle2 className="h-5 w-5 mr-2" />
                                                                    Taken
                                                                </span>
                                                            ) : (
                                                                "Mark Taken"
                                                            )}
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar: Calendar & Progress */}
                    <div className="space-y-8">
                        {/* Medication Calendar */}
                        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white">
                            <CardHeader className="border-b border-slate-50 pb-4">
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <CalendarIcon className="h-5 w-5 text-blue-600" />
                                    Medication Calendar
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 sm:p-6">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <button
                                            onClick={handlePrevMonth}
                                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                                        >
                                            <ChevronLeft className="h-5 w-5" />
                                        </button>
                                        <span className="font-bold text-slate-800">
                                            {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button
                                            onClick={handleNextMonth}
                                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                                        >
                                            <ChevronRight className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest gap-y-4">
                                        <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>

                                        {(() => {
                                            const year = viewDate.getFullYear();
                                            const month = viewDate.getMonth();
                                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                                            const firstDayOfMonth = new Date(year, month, 1).getDay();

                                            const elements = [];

                                            // Add empty slots for the beginning of the month
                                            for (let i = 0; i < firstDayOfMonth; i++) {
                                                elements.push(<div key={`empty-${i}`} />);
                                            }

                                            // Add day slots
                                            for (let day = 1; day <= daysInMonth; day++) {
                                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                const isToday = dateStr === today;
                                                const dayLogs = monthlyLogs[dateStr] || [];

                                                const hasTaken = dayLogs.some(l => l.status === 'taken');
                                                const hasMissed = dayLogs.some(l => l.status === 'missed');

                                                elements.push(
                                                    <div key={day} className="relative flex flex-col items-center">
                                                        <div className={cn(
                                                            "h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all relative z-10",
                                                            isToday ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600",
                                                        )}>
                                                            {day}
                                                            {isToday && (
                                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                                                            )}
                                                        </div>
                                                        <div className="mt-1 flex gap-0.5 h-1">
                                                            {hasTaken && <div className="w-1 h-1 bg-emerald-400 rounded-full" />}
                                                            {hasMissed && <div className="w-1 h-1 bg-rose-400 rounded-full" />}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return elements;
                                        })()}
                                    </div>

                                    <div className="pt-4 border-t border-slate-50 space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                            <div className="h-2 w-2 bg-emerald-400 rounded-full" />
                                            <span>Medication taken</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                            <div className="h-2 w-2 bg-rose-400 rounded-full" />
                                            <span>Missed medication</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tip/Info Card */}
                        <div className="bg-sky-600 rounded-3xl p-6 text-white shadow-xl shadow-sky-200/50 space-y-4">
                            <div className="bg-white/20 h-10 w-10 rounded-xl flex items-center justify-center">
                                <AlertCircle className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="font-bold text-lg">Daily Tip</h4>
                                <p className="text-sky-100 text-sm leading-relaxed">
                                    Take your medicine with a full glass of water unless otherwise directed by your doctor.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
