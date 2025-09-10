import { SQSHandler } from 'aws-lambda';
import { insertAppointment } from '../services/rds.js';
import { sendConfirmation } from '../services/eventbridge.js';

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const payload = JSON.parse(record.body);
    // RawMessageDelivery=true → el body ya es el publicado en SNS
    // payload es el mensaje original del publishAppointment
    try {
      await insertAppointment('appointments_pe', {
        insuredId: payload.insuredId,
        scheduleId: payload.scheduleId,
        centerId: payload.centerId,
        specialtyId: payload.specialtyId,
        medicId: payload.medicId,
        date: payload.date
      });
      await sendConfirmation({ id: payload.id, insuredId: payload.insuredId, countryISO: 'PE' });
    } catch (e) {
      console.error('Error PE:', e);
      // En el reto no se pide manejo de errores/retentos específicos
    }
  }
};
