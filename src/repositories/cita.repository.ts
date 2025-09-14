import type { Cita } from "../models/Cita.js";

export interface CitaLecturaRepository {
    consultarPorAseguradoId(aseguradoId: string): Promise<Cita[]>;
}

export interface CitaEscrituraRepository {
    guardar(cita: Cita): Promise<void>;
    marcarCompletada(citaUuid: string): Promise<void>;
}

export interface CitaRdsRepository {
    escribirPorPais(cita: Cita): Promise<void>;
}