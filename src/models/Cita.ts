export interface Cita {
  citaUuid: string;
  aseguradoId: string;
  scheduleId: number;
  paisISO: 'PE' | 'CL';
  estado: 'pending' | 'completed';
  fechaCreacion: string;
}