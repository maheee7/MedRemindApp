import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with Service Role Key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const resendApiKey = process.env.RESEND_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        // 1. Calculate the time 1 hour ago
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const hourStr = oneHourAgo.getHours().toString().padStart(2, '0');
        const minStr = oneHourAgo.getMinutes().toString().padStart(2, '0');
        const exactTime = `${hourStr}:${minStr}:00`;

        console.log(`Checking for misses at scheduled time: ${exactTime}`);

        // 2. Fetch schedules matching that exact time (approximately)
        // Note: Depending on cron frequency, you might want a range (e.g., between 59 and 65 mins ago)
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
            .eq('time', exactTime);

        if (scheduleError) throw scheduleError;

        if (!schedules || schedules.length === 0) {
            return res.status(200).json({ message: 'No schedules found for this window.' });
        }

        const reports = [];

        for (const schedule of schedules) {
            // 3. Check if a log exists for this schedule today
            const { data: log, error: logError } = await supabase
                .from('medication_logs')
                .select('id')
                .eq('schedule_id', schedule.id)
                .eq('date', today)
                .single();

            if (!log) {
                // MISS DETECTED
                console.log(`Miss detected for schedule ${schedule.id}`);

                // 4. Fetch caretaker/patient info (For now we send to a hardcoded or user-linked email)
                // In a real app, you'd fetch the email from the user's profile or a linked caretaker table.
                // Assuming for now we send to the patient's registered email + caretaker placeholder.

                const medicineName = (schedule.medications as any).name;
                const userId = (schedule.medications as any).user_id;

                // 4. Fetch caretaker info and patient name
                const { data: { user: caretakerUser }, error: userError } = await supabase.auth.admin.getUserById(userId);
                const { data: profile } = await supabase.from('profiles').select('patient_name').eq('id', userId).single();

                if (userError || !caretakerUser?.email) {
                    console.error(`Could not fetch email for user ${userId}:`, userError);
                    continue;
                }

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
                                <p><strong>Current Time:</strong> ${now.toLocaleTimeString()}</p>
                                <hr />
                                <p style="font-size: 12px; color: #666;">This is an automated safety alert from MediCare Companion.</p>
                            </div>
                        `
                    })
                });

                const emailData = await emailResponse.json();
                reports.push({ scheduleId: schedule.id, emailId: emailData.id });
            }
        }

        return res.status(200).json({
            message: 'Check complete',
            reports
        });

    } catch (err: any) {
        console.error('Cron Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
