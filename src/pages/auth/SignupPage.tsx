import { SignupForm } from "../../features/auth/components/SignupForm";
import { Card, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Pill as MedicinePill } from "lucide-react";

export default function SignupPage() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4 py-12">
            <Card className="w-full max-w-2xl shadow-xl border-t-4 border-t-primary">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-2">
                        <MedicinePill className="text-primary h-6 w-6" />
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight">Join MedRemind</CardTitle>
                    <CardDescription>
                        Create a shared account for both the Patient and Caretaker.
                    </CardDescription>
                </CardHeader>
                <SignupForm />
                <div className="px-6 pb-6 text-center text-sm">
                    <p className="text-muted-foreground">
                        Already have an account?{" "}
                        <a href="/login" className="text-primary font-medium hover:underline">
                            Sign in here
                        </a>
                    </p>
                </div>
            </Card>
        </div>
    );
}
