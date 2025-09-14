import { randomUUID } from "crypto";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { Cita } from "../models/Cita.js";
import type {
    CitaLecturaRepository,
    CitaEscrituraRepository,
    CitaRdsRepository,
} from "../repositories/cita.repository.js";

export class CitaService {
    constructor(
        private readonly lectura: CitaLecturaRepository,
        private readonly escritura: CitaEscrituraRepository,
        private readonly rds: CitaRdsRepository,
        private readonly sns = new SNSClient({})
    ) { }

    async crear(input: {
        aseguradoId: string;
        scheduleId: number;
        paisISO: "PE" | "CL";
    }): Promise<Cita> {
        const cita: Cita = {
            citaUuid: randomUUID(),
            aseguradoId: input.aseguradoId,
            scheduleId: input.scheduleId,
            paisISO: input.paisISO,
            estado: "pending",
            fechaCreacion: new Date().toISOString(),
        };

        await this.escritura.guardar(cita);

        await this.sns.send(
            new PublishCommand({
                TopicArn: process.env.SNS_CITAS_ARN!,
                Message: JSON.stringify(cita),
                MessageAttributes: {
                    paisISO: { DataType: "String", StringValue: cita.paisISO },
                },
            })
        );

        return cita;
    }

    listarPorAsegurado(aseguradoId: string): Promise<Cita[]> {
        return this.lectura.consultarPorAseguradoId(aseguradoId);
    }

    completar(citaUuid: string): Promise<void> {
        return this.escritura.marcarCompletada(citaUuid);
    }

    escribirEnRds(cita: Cita): Promise<void> {
        return this.rds.escribirPorPais(cita);
    }
}