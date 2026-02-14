import { z } from "zod";

export const loginSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    patient_name: z.string().min(2, "Patient name must be at least 2 characters"),
    caretaker_name: z.string().min(2, "Caretaker name must be at least 2 characters"),
    caretaker_email: z.string().email("Please enter a valid caretaker email"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type SignupFormValues = z.infer<typeof signupSchema>;
