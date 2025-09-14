import { citaMakeService } from "../index.js";
import { ok, created, bad } from "../utils/http.js";

const svc = citaMakeService();

export const crearCita = async (event: any) => {
  if (!event.body) return bad("Body requerido");

  let payload: any;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return bad("Body inválido (JSON)");
  }

  const { aseguradoId, scheduleId, paisISO } = payload;

  if (!aseguradoId || scheduleId == null || !paisISO) {
    return bad("aseguradoId, scheduleId y paisISO son requeridos");
  }
  if (!["PE", "CL"].includes(String(paisISO))) {
    return bad("paisISO debe ser 'PE' o 'CL'");
  }
  if (Number.isNaN(Number(scheduleId))) {
    return bad("scheduleId debe ser numérico");
  }

  const cita = await svc.crear({
    aseguradoId: String(aseguradoId),
    scheduleId: Number(scheduleId),
    paisISO: paisISO,
  });
  return created(cita);
};

export const listarPorAsegurado = async (event: any) => {
  const aseguradoId = event.pathParameters?.aseguradoId;
  if (!aseguradoId) return bad("aseguradoId requerido");
  return ok(await svc.listarPorAsegurado(String(aseguradoId)));
};

export const confirmarCita = async (event: any) => {
  for (const r of event.Records ?? []) {
    let body: any;
    try {
      body = JSON.parse(r.body);
    } catch {
      continue;
    }
    const detail = body?.detail ?? body;
    const { citaUuid } = detail;
    if (!citaUuid) continue;

    await svc.completar(String(citaUuid));
  }
};