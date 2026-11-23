export const reportStatuses = {
  pending_review: 'Pendiente de revisión',
  in_review: 'En revisión',
  approved: 'Aprobado',
  in_progress: 'En atención',
  resolved: 'Resuelto',
  rejected: 'Descartado',
} as const;

export type ReportStatus = keyof typeof reportStatuses;

export const reportStatusMessages: Record<ReportStatus, string> = {
  pending_review: 'Recibimos tu reporte. Está pendiente de la primera revisión.',
  in_review: 'El equipo está revisando la información de tu reporte.',
  approved: 'El equipo validó el reporte y lo dejó listo para su atención.',
  in_progress: 'El equipo inició la atención del reporte.',
  resolved: 'El equipo marcó el reporte como resuelto.',
  rejected: 'El equipo descartó el reporte. Consulta el motivo en el historial.',
};

const date = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota',
});

export const formatReportDate = (value: string) => date.format(new Date(value));
