import { SQSHandler } from 'aws-lambda';
import { insertAppointment } from '../services/rds.js';
import { sendConfirmation } from '../services/eventbridge.js';

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const payload = JSON.parse(record.body);
    try {
      await insertAppointment('appointments_cl', {
        insuredId: payload.insuredId,
        scheduleId: payload.scheduleId,
        centerId: payload.centerId,
        specialtyId: payload.specialtyId,
        medicId: payload.medicId,
        date: payload.date
      });
      await sendConfirmation({ id: payload.id, insuredId: payload.insuredId, countryISO: 'CL' });
    } catch (e) {
      console.error('Error CL:', e);
    }
  }
};
