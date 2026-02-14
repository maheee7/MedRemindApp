import { z } from "zod";

export const medicationSchema = z.object({
    medicine_name: z.string().min(1, "Medicine name is required"),
    dosage: z.string().min(1, "Dosage is required"),
    start_date: z.string().min(1, "Start date is required"),
    duration_type: z.enum(["days", "lifetime"]),
    duration_days: z.number().min(1, "Duration must be at least 1 day").optional().nullable(),
    scheduled_times: z.array(z.object({
        time: z.string().min(1, "Time is required")
    })).min(1, "At least one scheduled time is required"),
}).refine((data) => {
    if (data.duration_type === "days" && !data.duration_days) {
        return false;
    }
    return true;
}, {
    message: "Duration in days is required",
    path: ["duration_days"],
});

export type MedicationFormValues = z.infer<typeof medicationSchema>;
