import mysql from 'mysql2/promise';

export async function withConnection() {
  const conn = await mysql.createConnection({
    host: process.env.RDS_HOST,
    port: Number(process.env.RDS_PORT || 3306),
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE,
  });
  return conn;
}

export async function insertAppointment(table: string, data: {
  insuredId: string;
  scheduleId: number;
  centerId?: number;
  specialtyId?: number;
  medicId?: number;
  date?: string;
}) {
  const conn = await withConnection();
  try {
    const sql = `INSERT INTO ${table} (insuredId, scheduleId, centerId, specialtyId, medicId, date)
                 VALUES (?, ?, ?, ?, ?, ?)`;
    const params = [data.insuredId, data.scheduleId, data.centerId ?? null, data.specialtyId ?? null, data.medicId ?? null, data.date ?? null];
    await conn.execute(sql, params);
  } finally {
    await conn.end();
  }
}
