import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Heart, User, Users, CheckCircle2 } from "lucide-react";

export default function RoleSelectionPage() {
    const navigate = useNavigate();

    const handleRoleSelect = (role: 'patient' | 'caretaker') => {
        console.log(`Selected role: ${role}`);
        if (role === 'patient') {
            navigate("/patient-dashboard");
        } else {
            navigate("/caretaker-dashboard");
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col items-center justify-center p-4">
            {/* Header Section */}
            <div className="text-center mb-12 animate-in fade-in slide-in-from-top duration-700">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg mb-6 rotate-3 hover:rotate-0 transition-transform duration-300">
                    <Heart className="text-white h-8 w-8" />
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
                    Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-cyan-600">MediCare Companion</span>
                </h1>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto font-medium">
                    Your trusted partner in medication management. Choose your role to get started with personalized features.
                </p>
            </div>

            {/* Selection Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
                {/* Patient Card */}
                <Card className="group relative overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-white">
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
                    <CardHeader className="text-center pt-8 pb-4">
                        <div className="mx-auto w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 delay-75">
                            <User className="text-blue-600 h-7 w-7" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-slate-800">I'm a Patient</CardTitle>
                        <CardDescription className="text-slate-500 mt-2">
                            Track your medication schedule and maintain your health records
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 px-8 pb-8">
                        <ul className="space-y-3">
                            <li className="flex items-center text-slate-600 text-sm font-medium">
                                <CheckCircle2 className="h-4 w-4 text-blue-500 mr-3 flex-shrink-0" />
                                Mark medications as taken
                            </li>
                            <li className="flex items-center text-slate-600 text-sm font-medium">
                                <CheckCircle2 className="h-4 w-4 text-blue-500 mr-3 flex-shrink-0" />
                                Upload proof photos (optional)
                            </li>
                            <li className="flex items-center text-slate-600 text-sm font-medium">
                                <CheckCircle2 className="h-4 w-4 text-blue-500 mr-3 flex-shrink-0" />
                                View your medication calendar
                            </li>
                            <li className="flex items-center text-slate-600 text-sm font-medium">
                                <CheckCircle2 className="h-4 w-4 text-blue-500 mr-3 flex-shrink-0" />
                                Large, easy-to-use interface
                            </li>
                        </ul>
                        <Button
                            onClick={() => handleRoleSelect('patient')}
                            size="lg"
                            className="w-full font-semibold shadow-lg shadow-blue-200 mt-6"
                        >
                            Continue as Patient
                        </Button>
                    </CardContent>
                </Card>

                {/* Caretaker Card */}
                <Card className="group relative overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-white">
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
                    <CardHeader className="text-center pt-8 pb-4">
                        <div className="mx-auto w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 delay-75">
                            <Users className="text-emerald-600 h-7 w-7" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-slate-800">I'm a Caretaker</CardTitle>
                        <CardDescription className="text-slate-500 mt-2">
                            Monitor and support your loved one's medication adherence

                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 px-8 pb-8">
                        <ul className="space-y-3">
                            <li className="flex items-center text-slate-600 text-sm font-medium">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-3 flex-shrink-0" />
                                Monitor medication compliance
                            </li>
                            <li className="flex items-center text-slate-600 text-sm font-medium">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-3 flex-shrink-0" />
                                Set up notification preferences
                            </li>
                            <li className="flex items-center text-slate-600 text-sm font-medium">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-3 flex-shrink-0" />
                                View detailed reports
                            </li>
                            <li className="flex items-center text-slate-600 text-sm font-medium">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-3 flex-shrink-0" />
                                Receive email alerts
                            </li>
                        </ul>
                        <Button
                            onClick={() => handleRoleSelect('caretaker')}
                            variant="success"
                            size="lg"
                            className="w-full font-semibold mt-6"
                        >
                            Continue as Caretaker
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Footer Text */}
            <p className="mt-12 text-slate-500 text-sm font-medium animate-pulse">
                You can switch between roles anytime after setup
            </p>
        </div>
    );
}
