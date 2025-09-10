import { APIGatewayProxyHandlerV2, SQSHandler } from 'aws-lambda';
import { v4 as uuid } from 'uuid';
import { badRequest, created, ok, serverError } from '../utils/http.js';
import { putAppointment, queryByInsuredId, markCompleted } from '../services/dynamo.js';
import { publishAppointment } from '../services/sns.js';

// POST /appointments
export const createAppointment: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : null;
    if (!body) return badRequest('Body requerido');
    const { insuredId, scheduleId, countryISO, centerId, specialtyId, medicId, date } = body;

    if (!insuredId || !/^[0-9]{5}$/.test(insuredId)) return badRequest('insuredId debe ser 5 dígitos');
    if (typeof scheduleId !== 'number') return badRequest('scheduleId numérico requerido');
    if (!['PE', 'CL'].includes(countryISO)) return badRequest('countryISO debe ser PE o CL');

    const item = {
      id: uuid(),
      insuredId,
      scheduleId,
      countryISO,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      centerId, specialtyId, medicId, date
    };

    await putAppointment(item);
    await publishAppointment(item);

    return created({ id: item.id, status: item.status });
  } catch (err: any) {
    console.error(err);
    return serverError('Error creando appointment');
  }
};

// GET /appointments/{insuredId}
export const getAppointments: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const insuredId = event.pathParameters?.insuredId;
    if (!insuredId) return badRequest('insuredId requerido');
    const items = await queryByInsuredId(insuredId);
    return ok(items);
  } catch (err: any) {
    console.error(err);
    return serverError('Error consultando appointments');
  }
};

// SQS (confirmationsQueue) → actualizar a completed
export const processConfirmations: SQSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      const msg = JSON.parse(record.body);
      // Si el mensaje viene de EventBridge → SQS, el detalle está anidado
      const detailRaw = msg?.detail ? msg.detail : msg;
      const detail = typeof detailRaw === 'string' ? JSON.parse(detailRaw) : detailRaw;
      const id = detail?.id;
      if (id) {
        await markCompleted(id);
      }
    } catch (e) {
      console.error('Error procesando confirmación', e);
    }
  }
};

export const confirmAppointment: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const id = event.pathParameters?.id;
    if (!id) return badRequest('id requerido');
    await markCompleted(id);
    return ok({ id, status: 'completed' });
  } catch (e) {
    console.error(e);
    return serverError('Error confirmando appointment');
  }
};