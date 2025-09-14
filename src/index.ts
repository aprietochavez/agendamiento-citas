import { CitaDynamoRepository } from "./repositories/citaDynamo.repository.js";
import { CitaRdsRepositoryImpl } from "./repositories/citaRds.repository.js";
import { CitaService } from "./services/cita.service.js";

export const citaMakeService = () => {
    const dynamo = new CitaDynamoRepository();
    const rds = new CitaRdsRepositoryImpl();
    return new CitaService(dynamo, dynamo, rds);
};