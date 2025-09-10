import fs from 'node:fs';
import path from 'node:path';
import type { Context } from 'aws-lambda';

// util para invocar handlers como Promise SIN callback
const asPromise = <T extends Function>(fn: T) =>
    fn as unknown as (event: any, context?: any) => Promise<any>;

// “BD” local (archivo) para modo offline
const DB_FILE = path.join(process.cwd(), '.offline-db.json');
function resetOfflineDb() {
    if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
}
function bodyOf(resp: any) {
    return JSON.parse(resp.body ?? '{}');
}

// Referencias a los handlers (se importan DESPUÉS de setear env)
let createAppointment: any;
let getAppointments: any;
let processConfirmations: any;

describe('Appointment flow (offline)', () => {
    const ctx = {} as Context;

    beforeAll(async () => {
        // 1) setea env ANTES de importar módulos
        process.env.IS_OFFLINE = 'true';
        process.env.TABLE_NAME = 'Appointments';

        // 2) limpia caché de módulos y ahora sí importa handlers
        jest.resetModules();
        ({ createAppointment, getAppointments, processConfirmations } =
            await import('../src/handlers/appointment'));
    });

    beforeEach(resetOfflineDb);
    afterAll(resetOfflineDb);

    it('rechaza insuredId inválido', async () => {
        const ev = {
            body: JSON.stringify({ insuredId: '1234', scheduleId: 1, countryISO: 'PE' }),
        };
        const res = await asPromise(createAppointment)(ev, ctx);
        expect(res.statusCode).toBe(400);
        expect(bodyOf(res).error).toMatch(/insuredId debe ser 5 dígitos/i);
    });

    it('crea, lista y confirma un appointment', async () => {
        // 1) crear
        const createEvent = {
            body: JSON.stringify({
                insuredId: '01234',
                scheduleId: 100,
                countryISO: 'PE',
                centerId: 4,
                specialtyId: 3,
                medicId: 4,
                date: '2024-09-30T12:30:00Z',
            }),
        };
        const created = await asPromise(createAppointment)(createEvent, ctx);
        expect(created.statusCode).toBe(201);
        const { id, status } = bodyOf(created);
        expect(status).toBe('pending');

        // 2) listar por asegurado
        const listEvent = { pathParameters: { insuredId: '01234' } };
        const listed = await asPromise(getAppointments)(listEvent, ctx);
        expect(listed.statusCode).toBe(200);
        const items = JSON.parse(listed.body);
        expect(items.find((x: any) => x.id === id)).toBeTruthy();

        // 3) confirmar (simula EventBridge→SQS)
        const confirmEvent = { Records: [{ body: JSON.stringify({ detail: { id } }) }] };
        await asPromise(processConfirmations)(confirmEvent, ctx); // no retorna body

        // 4) verificar completed
        const listed2 = await asPromise(getAppointments)(listEvent, ctx);
        const items2 = JSON.parse(listed2.body);
        expect(items2.find((x: any) => x.id === id).status).toBe('completed');
    });
});
