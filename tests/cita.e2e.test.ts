import { mockClient } from "aws-sdk-client-mock";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import {
    DynamoDBDocumentClient,
    PutCommand,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Context } from "aws-lambda";

const snsMock = mockClient(SNSClient);
const ddbMock = mockClient(DynamoDBDocumentClient);
const json = (r: any) => JSON.parse(r?.body ?? "{}");
describe("Flujo Cita (mínimo del reto)", () => {
    let crearCita: any;
    let listarPorAsegurado: any;
    let confirmarCita: any;
    const ctx = {} as Context;

    beforeAll(async () => {
        process.env.TABLE_CITAS = "Citas";
        process.env.SNS_CITAS_ARN = "arn:aws:sns:us-east-1:111111111111:citas";
        process.env.EB_BUS_NAME = "citas-bus";
        process.env.AWS_REGION = "us-east-1";
        const m = await import("../src/handlers/cita.ts");
        crearCita = m.crearCita;
        listarPorAsegurado = m.listarPorAsegurado;
        confirmarCita = m.confirmarCita;
    });

    beforeEach(() => {
        snsMock.reset();
        ddbMock.reset();
    });

    it("crea, lista y confirma una cita", async () => {
        const aseguradoId = "01234";
        const scheduleId = 100;
        const paisISO = "PE";
        snsMock.on(PublishCommand).resolves({});
        ddbMock.on(PutCommand).resolves({});
        const resCreate = await crearCita(
            { body: JSON.stringify({ aseguradoId, scheduleId, paisISO }) },
            ctx
        );
        expect(resCreate.statusCode).toBe(201);
        const created = json(resCreate);
        expect(created.estado).toBe("pending");
        expect(created.citaUuid).toBeTruthy();
        const { citaUuid } = created;
        ddbMock
            .on(QueryCommand)
            .resolvesOnce({
                Items: [
                    {
                        citaUuid,
                        aseguradoId: aseguradoId,
                        scheduleId,
                        paisISO: paisISO,
                        estado: "pending",
                        fechaCreacion: new Date().toISOString(),
                    },
                ],
            })
            .resolves({
                Items: [
                    {
                        citaUuid,
                        aseguradoId: aseguradoId,
                        scheduleId,
                        paisISO: paisISO,
                        estado: "completed",
                        fechaCreacion: new Date().toISOString(),
                    },
                ],
            });
        const resList1 = await listarPorAsegurado(
            { pathParameters: { aseguradoId: aseguradoId } },
            ctx
        );
        expect(resList1.statusCode).toBe(200);
        const list1 = JSON.parse(resList1.body);
        expect(Array.isArray(list1)).toBe(true);
        expect(list1[0].citaUuid).toBe(citaUuid);
        expect(list1[0].estado).toBe("pending");
        ddbMock.on(UpdateCommand).resolves({});
        await confirmarCita(
            { Records: [{ body: JSON.stringify({ detail: { citaUuid } }) }] },
            ctx
        );
        const resList2 = await listarPorAsegurado(
            { pathParameters: { aseguradoId: aseguradoId } },
            ctx
        );
        expect(resList2.statusCode).toBe(200);
        const list2 = JSON.parse(resList2.body);
        expect(list2[0].citaUuid).toBe(citaUuid);
        expect(list2[0].estado).toBe("completed");
    });
});