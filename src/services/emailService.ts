// No imports needed for standard fetch

export const emailService = {
    /**
     * Sends a reminder email via Resend (Vercel API).
     */
    sendReminder: async (email: string, patientName: string, medicineName: string) => {
        try {
            const response = await fetch('/api/send-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: email,
                    subject: `Medication Reminder: ${medicineName}`,
                    patientName,
                    medicineName
                }),
            });

            if (!response.ok) throw new Error('API request failed');
            return await response.json();
        } catch (err) {
            console.error("Failed to send reminder email:", err);
            throw err;
        }
    },

    /**
     * Sends a critical alert to the caretaker.
     */
    sendCriticalAlert: async (caretakerEmail: string, patientName: string, medicineName: string, scheduledTime: string) => {
        try {
            const response = await fetch('/api/send-critical-alert', { // Note: You can create this route similar to send-reminder
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: caretakerEmail,
                    subject: `CRITICAL: Missed Medication Alert for ${patientName}`,
                    patientName,
                    medicineName,
                    scheduledTime
                }),
            });

            if (!response.ok) throw new Error('API request failed');
            return await response.json();
        } catch (err) {
            console.error("Failed to send critical alert:", err);
            throw err;
        }
    }
};
