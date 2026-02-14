import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { medicationSchema, type MedicationFormValues } from "../features/medications/medicationSchemas";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../components/ui/Card";
import { Pill, Clock, Calendar, CheckCircle2, Plus, Trash2, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useState } from "react";

export default function AddMedicationPage() {
    const navigate = useNavigate();
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

    const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<MedicationFormValues>({
        resolver: zodResolver(medicationSchema),
        defaultValues: {
            medicine_name: "",
            dosage: "",
            start_date: new Date().toLocaleDateString('en-CA'),
            duration_type: "days",
            duration_days: 7,
            scheduled_times: [{ time: "" }],
        }
    });

    const durationType = useWatch({
        control,
        name: "duration_type",
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "scheduled_times",
    });

    const onSubmit = async (values: MedicationFormValues, event?: React.BaseSyntheticEvent) => {
        const action = (event?.nativeEvent as any)?.submitter?.name;

        try {
            setSubmitError(null);
            setSubmitSuccess(false);

            // 1. Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) throw new Error("Authentication required");

            // 2. Insert into medications table
            const { data: medData, error: medError } = await supabase
                .from('medications')
                .insert([{
                    user_id: user.id,
                    name: values.medicine_name,
                    dosage: values.dosage,
                    start_date: values.start_date,
                    duration_type: values.duration_type,
                    duration_days: values.duration_type === "days" ? values.duration_days : null,
                }])
                .select()
                .single();

            if (medError) throw medError;

            // 3. Insert associated schedules
            const schedules = values.scheduled_times.map(st => ({
                medication_id: medData.id,
                time: st.time
            }));

            const { error: scheduleError } = await supabase
                .from('medication_schedules')
                .insert(schedules);

            if (scheduleError) throw scheduleError;

            if (action === "add_another") {
                setSubmitSuccess(true);
                reset({
                    medicine_name: "",
                    dosage: "",
                    start_date: values.start_date, // Keep the same start date for convenience
                    duration_type: "days",
                    duration_days: 7,
                    scheduled_times: [{ time: "" }],
                });
                // Clear success message after 3 seconds
                setTimeout(() => setSubmitSuccess(false), 3000);
            } else {
                // Navigate to role selection after finishing
                navigate("/role-selection");
            }
        } catch (err: any) {
            console.error("Failed to add medication:", err);
            setSubmitError(err.message || "An unexpected error occurred while saving.");
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col items-center justify-center p-4">
            <Card className="w-full max-w-2xl shadow-xl border-none overflow-hidden bg-white">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500" />
                <CardHeader className="text-center space-y-2 pt-8">
                    <div className="mx-auto bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-2 shadow-sm">
                        <Pill className="text-blue-600 h-8 w-8" />
                    </div>
                    <CardTitle className="text-3xl font-extrabold text-slate-900 tracking-tight">Add Medication</CardTitle>
                    <CardDescription className="text-slate-500 text-lg font-medium">
                        Enter the details to keep the health schedule updated.
                    </CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6 px-8">
                        {submitError && (
                            <div className="flex items-center gap-2 p-4 text-sm font-medium text-destructive bg-destructive/10 rounded-lg border border-destructive/20 animate-in fade-in zoom-in-95 duration-200">
                                <AlertCircle className="h-4 w-4" />
                                {submitError}
                            </div>
                        )}

                        {submitSuccess && (
                            <div className="flex items-center gap-2 p-4 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg border border-emerald-100 animate-in fade-in zoom-in-95 duration-200">
                                <CheckCircle2 className="h-4 w-4" />
                                Medication added successfully! You can add another one below.
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="medicine_name" className="text-slate-700 font-semibold flex items-center">
                                    <Pill className="h-4 w-4 mr-2 text-slate-400" />
                                    Medicine Name
                                </Label>
                                <Input
                                    id="medicine_name"
                                    placeholder="e.g. Paracetamol"
                                    {...register("medicine_name")}
                                    className={`h-11 ${errors.medicine_name ? "border-destructive ring-destructive/20" : "border-slate-200 focus:border-blue-500 focus:ring-blue-200"}`}
                                />
                                {errors.medicine_name && (
                                    <p className="text-xs text-destructive font-medium">{errors.medicine_name.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="dosage" className="text-slate-700 font-semibold flex items-center">
                                    <CheckCircle2 className="h-4 w-4 mr-2 text-slate-400" />
                                    Dosage
                                </Label>
                                <Input
                                    id="dosage"
                                    placeholder="e.g. 500mg, 1 tablet"
                                    {...register("dosage")}
                                    className={`h-11 ${errors.dosage ? "border-destructive ring-destructive/20" : "border-slate-200 focus:border-blue-500 focus:ring-blue-200"}`}
                                />
                                {errors.dosage && (
                                    <p className="text-xs text-destructive font-medium">{errors.dosage.message}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="start_date" className="text-slate-700 font-semibold flex items-center">
                                    <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                                    Start Date
                                </Label>
                                <Input
                                    id="start_date"
                                    type="date"
                                    {...register("start_date")}
                                    className={`h-11 ${errors.start_date ? "border-destructive ring-destructive/20" : "border-slate-200 focus:border-blue-500 focus:ring-blue-200"}`}
                                />
                                {errors.start_date && (
                                    <p className="text-xs text-destructive font-medium">{errors.start_date.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="duration_type" className="text-slate-700 font-semibold flex items-center">
                                    <Clock className="h-4 w-4 mr-2 text-slate-400" />
                                    Frequency
                                </Label>
                                <select
                                    id="duration_type"
                                    {...register("duration_type")}
                                    className="flex h-11 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all focus:border-blue-500"
                                >
                                    <option value="days">Days</option>
                                    <option value="lifetime">Life Time</option>
                                </select>
                                {errors.duration_type && (
                                    <p className="text-xs text-destructive font-medium">{errors.duration_type.message}</p>
                                )}
                            </div>
                        </div>

                        {durationType === "days" && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <Label htmlFor="duration_days" className="text-slate-700 font-semibold flex items-center">
                                    <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                                    How many days?
                                </Label>
                                <Input
                                    id="duration_days"
                                    type="number"
                                    placeholder="e.g. 7"
                                    {...register("duration_days", { valueAsNumber: true })}
                                    className={`h-11 ${errors.duration_days ? "border-destructive ring-destructive/20" : "border-slate-200 focus:border-blue-500 focus:ring-blue-200"}`}
                                />
                                {errors.duration_days && (
                                    <p className="text-xs text-destructive font-medium">{errors.duration_days.message}</p>
                                )}
                            </div>
                        )}

                        <div className="space-y-4 pt-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-700 font-semibold flex items-center uppercase text-xs tracking-wider">
                                    <Clock className="h-4 w-4 mr-2 text-blue-500" />
                                    Medication Schedule Times
                                </Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ time: "" })}
                                    className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Time
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="group flex items-start gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                        <div className="flex-1 space-y-1">
                                            <div className="relative">
                                                <Input
                                                    type="time"
                                                    {...register(`scheduled_times.${index}.time` as const)}
                                                    className={`h-11 ${errors.scheduled_times?.[index]?.time ? "border-destructive ring-destructive/20" : "border-slate-200 focus:border-blue-500 focus:ring-blue-200"}`}
                                                />
                                            </div>
                                            {errors.scheduled_times?.[index]?.time && (
                                                <p className="text-xs text-destructive font-medium">
                                                    {errors.scheduled_times[index]?.time?.message}
                                                </p>
                                            )}
                                        </div>
                                        {fields.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => remove(index)}
                                                className="h-11 w-11 text-slate-400 hover:text-destructive hover:bg-destructive/5 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                {errors.scheduled_times?.root && (
                                    <p className="text-xs text-destructive font-medium">{errors.scheduled_times.root.message}</p>
                                )}
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="px-8 pb-8 pt-4 flex flex-col sm:flex-row gap-4">
                        <Button
                            type="submit"
                            name="add_another"
                            disabled={isSubmitting}
                            variant="outline"
                            className="flex-1 h-12 text-blue-600 border-2 border-blue-600 hover:bg-blue-50 font-bold transition-all disabled:opacity-50"
                        >
                            Add Another Medicine
                        </Button>
                        <Button
                            type="submit"
                            name="finish"
                            disabled={isSubmitting}
                            className="flex-1 h-12 text-white bg-blue-600 hover:bg-blue-700 font-bold shadow-lg shadow-blue-200 transition-all transform active:scale-[0.98] disabled:opacity-50"
                        >
                            {isSubmitting ? "Saving..." : "Finish and Continue"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
            <p className="mt-6 text-slate-500 text-sm font-medium">
                Step 1 of 2: Let's get the health schedule started
            </p>
        </div>
    );
}
