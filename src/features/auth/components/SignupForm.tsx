import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupFormValues } from "../authSchemas";
import { authService } from "../authService";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Label } from "../../../components/ui/Label";
import { CardContent, CardFooter } from "../../../components/ui/Card";
import { Loader2 } from "lucide-react";

export function SignupForm() {
    const [error, setError] = useState<string | null>(null);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<SignupFormValues>({
        resolver: zodResolver(signupSchema),
    });

    const navigate = useNavigate();

    const onSubmit = async (values: SignupFormValues) => {
        try {
            setError(null);
            await authService.signUp(values);
            navigate("/add-medication");
        } catch (err: any) {
            setError(err.message || "Failed to create account");
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="patient_name">Patient Name</Label>
                        <Input
                            id="patient_name"
                            placeholder="Enter patient name"
                            {...register("patient_name")}
                            className={errors.patient_name ? "border-destructive" : ""}
                        />
                        {errors.patient_name && (
                            <p className="text-xs text-destructive">{errors.patient_name.message}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="caretaker_name">Caretaker Name</Label>
                        <Input
                            id="caretaker_name"
                            placeholder="Enter caretaker name"
                            {...register("caretaker_name")}
                            className={errors.caretaker_name ? "border-destructive" : ""}
                        />
                        {errors.caretaker_name && (
                            <p className="text-xs text-destructive">{errors.caretaker_name.message}</p>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="caretaker_email">Caretaker Contact Email (for alerts)</Label>
                    <Input
                        id="caretaker_email"
                        type="email"
                        placeholder="caretaker@example.com"
                        {...register("caretaker_email")}
                        className={errors.caretaker_email ? "border-destructive" : ""}
                    />
                    {errors.caretaker_email && (
                        <p className="text-xs text-destructive">{errors.caretaker_email.message}</p>
                    )}
                </div>

                <div className="border-t pt-4 my-2">
                    <p className="text-xs text-muted-foreground mb-4">Account Login Details</p>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email address</Label>
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
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button className="w-full" type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Shared Account
                </Button>
            </CardFooter>
        </form>
    );
}
