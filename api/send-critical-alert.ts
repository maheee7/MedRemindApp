export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { to, subject, patientName, medicineName, scheduledTime } = req.body;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
        console.error('Missing RESEND_API_KEY');
        return res.status(500).json({ error: 'Configuration Error: Missing RESEND_API_KEY' });
    }

    if (!to) {
        return res.status(400).json({ error: 'Recipient address (to) is required' });
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
                from: 'onboarding@resend.dev',
                to: [to],
                subject: subject,
                html: `
                    <div style="font-family: sans-serif; padding: 24px; border: 2px solid #e11d48; border-radius: 12px; background-color: #fffafb;">
                        <h2 style="color: #e11d48; margin-top: 0;">⚠️ Critical Medication Missed</h2>
                        <p style="font-size: 16px; color: #1e293b;">
                            This is an urgent alert that <strong>${patientName}</strong> has missed their scheduled medication.
                        </p>
                        <div style="background-color: #fff; padding: 16px; border-radius: 8px; border: 1px solid #fee2e2;">
                            <p style="margin: 0; color: #64748b;">Medication: <strong style="color: #0f172a;">${medicineName}</strong></p>
                            <p style="margin: 8px 0 0 0; color: #64748b;">Scheduled Time: <strong style="color: #0f172a;">${scheduledTime}</strong></p>
                        </div>
                        <p style="margin-top: 20px; color: #475569; font-style: italic;">
                            Please check on the patient as soon as possible.
                        </p>
                        <hr style="border: none; border-top: 1px solid #fee2e2; margin: 24px 0;" />
                        <p style="font-size: 12px; color: #94a3b8;">MediCare Companion Safety Net System</p>
                    </div>
                `
            })
        });

        const data = await response.json().catch(() => ({ message: 'Failed to parse JSON response' }));

        if (!response.ok) {
            console.error('Resend API error:', data);
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);
    } catch (err: any) {
        console.error('Send Critical Alert error:', err);
        return res.status(500).json({ error: err.message });
    }
}
