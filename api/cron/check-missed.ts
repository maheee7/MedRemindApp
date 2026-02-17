import { createClient } from '@supabase/supabase-js';

// Support both local and different Vercel configurations
const getEnv = (name: string) => {
    return process.env[name] || process.env[`NEXT_PUBLIC_${name}`] || process.env[`VITE_${name}`];
};

export default async function handler(req: any, res: any) {
    // Only allow GET requests (or whatever the cron provider sends)
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('Cron process started...');

    // 0. Extract Environment Variables with fallbacks
    const supabaseUrl = getEnv('SUPABASE_URL');
    const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = getEnv('RESEND_API_KEY');

    // 0. Validate Environment Information
    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
        const missing = [];
        if (!supabaseUrl) missing.push('SUPABASE_URL (or VITE_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL)');
        if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
        if (!resendApiKey) missing.push('RESEND_API_KEY');

        const errorMsg = `Missing configuration: ${missing.join(', ')}`;
        console.error(errorMsg);
        return res.status(500).json({
            error: 'Configuration Error',
            details: errorMsg,
            help: "Please ensure these variables are set in your Vercel Project Settings -> Environment Variables."
        });
    }

    // Safety check before creating client
    let supabase;
    try {
        supabase = createClient(supabaseUrl, supabaseServiceKey);
    } catch (clientErr: any) {
        console.error('Failed to initialize Supabase client:', clientErr);
        return res.status(500).json({ error: 'Initialization Error', message: clientErr.message });
    }

    try {
        // Adjust for IST (India Standard Time) as the server is likely in UTC
        const now = new Date();
        const IST_OFFSET = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(now.getTime() + IST_OFFSET);

        // Use IST for the date string to ensure we look at the correct day in India
        const today = istTime.toISOString().split('T')[0];

        // 1. Calculate the time window in IST (checks schedules from 60 to 90 minutes ago)
        const windowEnd = new Date(istTime.getTime() - 60 * 60 * 1000);
        const windowStart = new Date(istTime.getTime() - 90 * 60 * 1000);

        // We use getUTCHours/Minutes because istTime already includes the +5.5h offset
        const startTimeStr = `${windowStart.getUTCHours().toString().padStart(2, '0')}:${windowStart.getUTCMinutes().toString().padStart(2, '0')}:00`;
        const endTimeStr = `${windowEnd.getUTCHours().toString().padStart(2, '0')}:${windowEnd.getUTCMinutes().toString().padStart(2, '0')}:00`;

        console.log(`Checking for misses in window: ${startTimeStr} to ${endTimeStr}`);

        // 2. Fetch schedules within this window
        const { data: schedules, error: scheduleError } = await supabase
            .from('medication_schedules')
            .select(`
                id, 
                time,
                medications (
                    name,
                    user_id
                )
            `)
            .gt('time', startTimeStr)
            .lte('time', endTimeStr);

        if (scheduleError) {
            console.error('Error fetching schedules:', scheduleError);
            throw new Error(`Database error fetching schedules: ${scheduleError.message}`);
        }

        if (!schedules || schedules.length === 0) {
            console.log('No schedules found in this time window.');
            return res.status(200).json({ message: 'No schedules found for this window.' });
        }

        const reports = [];

        for (const schedule of schedules) {
            try {
                // 3. Check if a log exists for this schedule today
                const { data: log, error: logError } = await supabase
                    .from('medication_logs')
                    .select('id')
                    .eq('schedule_id', schedule.id)
                    .eq('date', today)
                    .maybeSingle();

                if (logError) {
                    console.error(`Error checking log for schedule ${schedule.id}:`, logError);
                    continue;
                }

                if (!log) {
                    // MISS DETECTED
                    console.log(`Miss detected for schedule ${schedule.id}`);

                    // Handle potential array or object for medications join
                    const medicationData = Array.isArray(schedule.medications)
                        ? schedule.medications[0]
                        : schedule.medications;

                    if (!medicationData) {
                        console.error(`Medication data missing for schedule ${schedule.id}`);
                        continue;
                    }

                    const medicineName = (medicationData as any).name;
                    const userId = (medicationData as any).user_id;

                    if (!userId) {
                        console.error(`User ID missing for medication in schedule ${schedule.id}`);
                        continue;
                    }

                    // 4. Fetch caretaker info and patient name
                    const authResponse = await supabase.auth.admin.getUserById(userId);
                    const caretakerUser = authResponse.data?.user;
                    const userError = authResponse.error;

                    if (userError || !caretakerUser?.email) {
                        console.error(`Could not fetch email for user ${userId}:`, userError || 'User not found or has no email');
                        continue;
                    }

                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('patient_name')
                        .eq('id', userId)
                        .single();

                    const settings = caretakerUser.user_metadata?.notificationSettings || {
                        emailNotifications: true,
                        missedAlerts: true
                    };

                    if (!settings.emailNotifications || !settings.missedAlerts) {
                        console.log(`Skipping notification for ${userId} (Disabled in settings)`);
                        continue;
                    }

                    const patientDisplay = profile?.patient_name || "the patient";

                    // 5. Send Email via Resend Fetch API
                    console.log(`Sending alert to ${caretakerUser.email} for ${medicineName}`);
                    const emailResponse = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${resendApiKey}`
                        },
                        body: JSON.stringify({
                            from: 'onboarding@resend.dev',
                            to: [caretakerUser.email],
                            subject: `CRITICAL: Missed Medication Alert`,
                            html: `
                                <div style="font-family: sans-serif; padding: 20px; border: 2px solid #e11d48; border-radius: 10px;">
                                    <h2 style="color: #e11d48;">Critical Missed Medication</h2>
                                    <p>Hi Caretaker,</p>
                                    <p>Our safety net system has detected that <strong>${patientDisplay}</strong> has missed their scheduled dose of <strong>${medicineName}</strong>.</p>
                                    <p><strong>Scheduled Time:</strong> ${schedule.time}</p>
                                    <p><strong>Current Time:</strong> ${istTime.getUTCHours().toString().padStart(2, '0')}:${istTime.getUTCMinutes().toString().padStart(2, '0')} IST</p>
                                    <hr />
                                    <p style="font-size: 12px; color: #666;">This is an automated safety alert from MediCare Companion.</p>
                                </div>
                            `
                        })
                    });

                    if (!emailResponse.ok) {
                        const errorData = await emailResponse.text();
                        console.error(`Resend API error: ${emailResponse.status}`, errorData);
                        continue;
                    }

                    const emailData = await emailResponse.json();
                    reports.push({ scheduleId: schedule.id, emailId: emailData.id });
                }
            } catch (innerErr: any) {
                console.error(`Unexpected error processing schedule ${schedule.id}:`, innerErr);
            }
        }

        return res.status(200).json({
            message: 'Check complete',
            reportsCount: reports.length,
            reports
        });

    } catch (err: any) {
        console.error('Final Cron Error Catch:', err);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: err.message
        });
    }
}
