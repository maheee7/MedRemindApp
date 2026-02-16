export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { to, subject, patientName, medicineName } = req.body;
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
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #2563eb;">Medication Reminder</h2>
                        <p>Hi Caretaker,</p>
                        <p>This is a helpful reminder to assist <strong>${patientName}</strong> with their medication: <strong>${medicineName}</strong>.</p>
                        <hr />
                        <p style="font-size: 12px; color: #666;">MediCare Companion - Your Digital Care Assistant.</p>
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
        console.error('Send Reminder error:', err);
        return res.status(500).json({ error: err.message });
    }
}
