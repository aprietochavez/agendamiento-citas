import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import type { Cita } from "../models/Cita.js";

const sns = new SNSClient({});
const topicArn = process.env.SNS_CITAS_ARN!;
export async function publishCita(message: Cita): Promise<void> {
  await sns.send(new PublishCommand({
    TopicArn: topicArn,
    Message: JSON.stringify(message),
    MessageAttributes: {
      paisISO: { DataType: "String", StringValue: message.paisISO },
    },
  }));
}