import { Link } from "react-router-dom";
import { LoginForm } from "../../features/auth/components/LoginForm";
import { Card, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Pill as MedicinePill } from "lucide-react";

export default function LoginPage() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
            <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-2">
                        <MedicinePill className="text-primary h-6 w-6" />
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight">MedRemind</CardTitle>
                    <CardDescription>
                        Welcome back! Please login to your shared account.
                    </CardDescription>
                </CardHeader>
                <LoginForm />
                <div className="px-6 pb-6 text-center text-sm">
                    <p className="text-muted-foreground">
                        Don't have an account?{" "}
                        <Link to="/signup" className="text-primary font-medium hover:underline">
                            Create a shared account
                        </Link>
                    </p>
                </div>
            </Card>
        </div>
    );
}
