export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { to, subject, patientName, medicineName } = req.body;
    const resendApiKey = process.env.RESEND_API_KEY!;

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

        const data = await response.json();
        return res.status(200).json(data);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
}
