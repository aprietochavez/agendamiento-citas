import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Appointment } from "../models/Appointment.js";
import fs from "node:fs";
import path from "node:path";

const isOffline = process.env.IS_OFFLINE === "true";
const TableName = process.env.TABLE_NAME!;

// Archivo local para modo offline (persiste entre requests)
const DB_FILE = path.join(process.cwd(), ".offline-db.json");

function readDb(): Record<string, Appointment> {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeDb(db: Record<string, Appointment>) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

export async function putAppointment(item: Appointment) {
  if (isOffline) {
    const db = readDb();
    db[item.id] = item;
    writeDb(db);
    console.log(`[OFFLINE][Dynamo] put ${item.id} -> ${DB_FILE}`);
    return;
  }
  await ddb.send(new PutCommand({ TableName, Item: item }));
}

export async function queryByInsuredId(insuredId: string) {
  if (isOffline) {
    const db = readDb();
    return Object.values(db).filter(x => x.insuredId === insuredId);
  }
  const out = await ddb.send(new QueryCommand({
    TableName,
    IndexName: "GSI1",
    KeyConditionExpression: "insuredId = :v",
    ExpressionAttributeValues: { ":v": insuredId }
  }));
  return out.Items ?? [];
}

export async function markCompleted(id: string) {
  if (isOffline) {
    const db = readDb();
    if (db[id]) {
      db[id].status = "completed";
      writeDb(db);
      console.log(`[OFFLINE][Dynamo] markCompleted ${id}`);
    }
    return;
  }
  await ddb.send(new UpdateCommand({
    TableName,
    Key: { id },
    UpdateExpression: "SET #s = :c",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":c": "completed" }
  }));
}
