import { supabase } from "../../lib/supabase";
import type { LoginFormValues, SignupFormValues } from "./authSchemas";


export const authService = {
    async signUp(values: SignupFormValues) {
        const { email, password, patient_name, caretaker_name, caretaker_email } = values;

        // 1. Sign up the user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });
        console.log(authData.session,"authData.session");
        

        if (authError) throw authError;

        // 2. Create the profile record
        if (authData.user) {
            const { error: profileError } = await supabase
                .from("profiles")
                .insert({
                    id: authData.user.id,
                    patient_name,
                    caretaker_name,
                    caretaker_email,
                });

            if (profileError) {
                // Cleanup: We could delete the auth user here if profile creation fails,
                // but often it's better to let the user retry or handle it in a recovery flow.
                throw profileError;
            }
        }

        return authData;
    },

    async signIn(values: LoginFormValues) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: values.email,
            password: values.password,
        });

        if (error) throw error;
        return data;
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    async getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        return { ...user, profile };
    }
};
