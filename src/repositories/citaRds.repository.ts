import mysql from "mysql2/promise";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import type { Cita } from "../models/Cita.js";
import type { CitaRdsRepository } from "./cita.repository.js";

type Pais = "PE" | "CL";
const ssm = new SSMClient({});
let cachedPassword: string | null = null;

async function getPassword(): Promise<string> {
    if (process.env.RDS_PASSWORD && process.env.RDS_PASSWORD.trim() !== "") {
        return process.env.RDS_PASSWORD;
    }
    if (cachedPassword) return cachedPassword;
    const name = process.env.RDS_PASSWORD_SSM;
    if (!name) throw new Error("RDS_PASSWORD_SSM no está definida");
    const out = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    const value = out.Parameter?.Value ?? "";
    if (!value) throw new Error("No se pudo leer contraseña de SSM o viene vacía");
    cachedPassword = value;
    return cachedPassword;
}

function cfg(pais: Pais) {
    return {
        host: process.env[pais === "PE" ? "RDS_PE_HOST" : "RDS_CL_HOST"]!,
        port: Number(process.env[pais === "PE" ? "RDS_PE_PORT" : "RDS_CL_PORT"] ?? 3306),
        user: process.env.RDS_USER!,
        database: process.env[pais === "PE" ? "RDS_PE_DATABASE" : "RDS_CL_DATABASE"]!,
    };
}

const pools: Partial<Record<Pais, mysql.Pool>> = {};

async function getPool(pais: Pais): Promise<mysql.Pool> {
    if (pools[pais]) return pools[pais]!;
    const password = await getPassword();
    const { host, port, user, database } = cfg(pais);
    console.log(`RDS ${pais} host=${host} db=${database} user=${user} hasPass=${password.length > 0}`);
    const pool = mysql.createPool({
        host, port, user, password, database,
        waitForConnections: true, connectionLimit: 2,
    });
    pools[pais] = pool;
    return pool;
}

export class CitaRdsRepositoryImpl implements CitaRdsRepository {
    async escribirPorPais(cita: Cita): Promise<void> {
        const pool = await getPool(cita.paisISO as Pais);
        const sql = `
      INSERT INTO citas (cita_uuid, asegurado_id, schedule_id, pais_iso, estado, fecha_creacion)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
        await pool.execute(sql, [
            cita.citaUuid,
            cita.aseguradoId,
            cita.scheduleId,
            cita.paisISO,
            cita.estado,
            cita.fechaCreacion,
        ]);
    }
}