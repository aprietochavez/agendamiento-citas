import type { SQSHandler } from "aws-lambda";
import { citaMakeService } from "../index.js";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const svc = citaMakeService();
const eb = new EventBridgeClient({});

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records ?? []) {
    const raw = JSON.parse(record.body);
    const payload = raw?.Message ? JSON.parse(raw.Message) : raw;
    await svc.escribirEnRds(payload);
    await eb.send(new PutEventsCommand({
      Entries: [{
        Source: "cita.cl",
        DetailType: "CitaConfirmada",
        Detail: JSON.stringify({ citaUuid: payload.citaUuid }),
        EventBusName: process.env.EB_BUS_NAME
      }]
    }));
  }
};