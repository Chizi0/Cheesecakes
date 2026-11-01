import { checkCertification } from './eligibility.mjs';

export function selectTechnician(technicians, job) {
  // Validate the requirement even if the technician list is empty.
  checkCertification({ certifications: [] }, job);
  const ids = new Set();
  for (const technician of technicians) {
    if (typeof technician?.id !== 'string' || !technician.id.trim() || ids.has(technician.id)) {
      throw new Error('Technician IDs must be present and unique.');
    }
    ids.add(technician.id);
  }
  const eligible = technicians.filter(technician =>
    checkCertification(technician, job).qualified
    && technician.available === true
    && technician.hasActiveJob === false
  );
  for (const technician of eligible) {
    if (!Number.isFinite(technician.travelMinutes) || technician.travelMinutes < 0) {
      throw new Error('Eligible technicians need a nonnegative travel estimate.');
    }
  }
  const ordered = [...eligible].sort((a, b) => a.travelMinutes - b.travelMinutes || a.id.localeCompare(b.id));
  const technician = ordered[0];
  return technician
    ? { technician, reason: 'Shortest estimated travel time among qualified, available technicians without an active job.' }
    : { technician: null, reason: 'No qualified technician is currently available.' };
}

export function assignJob(job, technicians) {
  if (typeof job?.id !== 'string' || !job.id.trim()) throw new Error('Job ID is required.');
  if (job.status !== 'pending' || job.technicianId) throw new Error('Only unassigned pending jobs can be dispatched.');
  if (technicians.some(technician => technician.activeJobId === job.id)) {
    throw new Error('This job already has a technician reservation.');
  }
  const selected = selectTechnician(technicians, job);
  if (!selected.technician) {
    return { assigned: false, job, technicians, notice: selected.reason };
  }
  const chosen = selected.technician;
  return {
    assigned: true,
    job: { ...job, status: 'assigned', technicianId: chosen.id },
    technicians: technicians.map(technician => technician.id === chosen.id
      ? { ...technician, available: false, hasActiveJob: true, activeJobId: job.id }
      : { ...technician }),
    notice: `Job ${job.id} automatically assigned to technician ${chosen.id}.`,
  };
}
