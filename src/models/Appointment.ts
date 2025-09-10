export interface Appointment {
  id: string;
  insuredId: string;
  scheduleId: number;
  countryISO: 'PE' | 'CL';
  status: 'pending' | 'completed';
  createdAt: string;
  // payload opcional con detalles del "espacio":
  centerId?: number;
  specialtyId?: number;
  medicId?: number;
  date?: string; // ISO
}
