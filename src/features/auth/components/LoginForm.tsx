import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "../authSchemas";
import { authService } from "../authService";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Label } from "../../../components/ui/Label";
import { CardContent, CardFooter } from "../../../components/ui/Card";
import { Loader2 } from "lucide-react";

export function LoginForm() {
    const [error, setError] = useState<string | null>(null);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    });

    const navigate = useNavigate();

    const onSubmit = async (values: LoginFormValues) => {
        try {
            setError(null);
            await authService.signIn(values);
            navigate("/role-selection");
        } catch (err: any) {
            setError(err.message || "Invalid email or password");
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
                {error && (
                    <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 rounded-md">
                        {error}
                    </div>
                )}
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="m@example.com"
                        {...register("email")}
                        className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && (
                        <p className="text-xs text-destructive">{errors.email.message}</p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                        id="password"
                        type="password"
                        {...register("password")}
                        className={errors.password ? "border-destructive" : ""}
                    />
                    {errors.password && (
                        <p className="text-xs text-destructive">{errors.password.message}</p>
                    )}
                </div>
            </CardContent>
            <CardFooter>
                <Button className="w-full" type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Login
                </Button>
            </CardFooter>
        </form>
    );
}
