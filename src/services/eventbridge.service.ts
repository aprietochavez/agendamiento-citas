import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const eb = new EventBridgeClient({});
const eventBusName = process.env.EB_BUS_NAME!;

type Source = "cita.pe" | "cita.cl";
interface ConfirmDetail { citaUuid: string; }

export async function sendConfirmation(source: Source, detail: ConfirmDetail): Promise<void> {
  await eb.send(new PutEventsCommand({
    Entries: [{
      Source: source,
      DetailType: "CitaConfirmada",
      Detail: JSON.stringify(detail),
      EventBusName: eventBusName,
    }],
  }));
}