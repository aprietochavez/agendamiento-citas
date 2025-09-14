import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { Cita } from "../models/Cita.js";
import type {
    CitaLecturaRepository,
    CitaEscrituraRepository,
} from "./cita.repository.js";
import { ddb } from "../config/ddb.js";

const TableName = process.env.TABLE_CITAS!;

export class CitaDynamoRepository
    implements CitaLecturaRepository, CitaEscrituraRepository {

    async guardar(cita: Cita): Promise<void> {
        await ddb.send(
            new PutCommand({
                TableName,
                Item: cita,
                ConditionExpression: "attribute_not_exists(citaUuid)",
            })
        );
    }

    async consultarPorAseguradoId(aseguradoId: string): Promise<Cita[]> {
        const res = await ddb.send(
            new QueryCommand({
                TableName,
                IndexName: "porAsegurado",
                KeyConditionExpression: "aseguradoId = :a",
                ExpressionAttributeValues: { ":a": aseguradoId },
                ScanIndexForward: false,
            })
        );
        return (res.Items as Cita[]) ?? [];
    }

    async marcarCompletada(citaUuid: string): Promise<void> {
        await ddb.send(
            new UpdateCommand({
                TableName,
                Key: { citaUuid },
                UpdateExpression: "SET #estado = :c",
                ExpressionAttributeNames: { "#estado": "estado" },
                ExpressionAttributeValues: { ":c": "completed" },
                ConditionExpression: "attribute_exists(citaUuid)",
            })
        );
    }
}