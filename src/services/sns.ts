import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
const isOffline = process.env.IS_OFFLINE === "true";
const sns = new SNSClient({});
const TopicArn = process.env.TOPIC_ARN as string;

export async function publishAppointment(message: any & { countryISO: 'PE' | 'CL' }) {
  if (isOffline) {
    console.log("[OFFLINE][SNS] Mensaje simulado:", JSON.stringify(message));
    return;
  }
  await sns.send(new PublishCommand({
    TopicArn,
    Message: JSON.stringify(message),
    MessageAttributes: { countryISO: { DataType: "String", StringValue: message.countryISO } }
  }));
}
