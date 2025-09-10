import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const eb = new EventBridgeClient({});
const EventBusName = process.env.BUS_NAME as string;

export async function sendConfirmation(detail: object) {
  await eb.send(new PutEventsCommand({
    Entries: [{
      Source: "appointment",
      DetailType: "AppointmentConfirmed",
      EventBusName,
      Detail: JSON.stringify(detail)
    }]
  }));
}
