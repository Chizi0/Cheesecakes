// Staff supply priority and required room type; this function only orders peers.
export function waitingPatients(patients, { clinicalPriority, roomType }) {
  if (typeof clinicalPriority !== 'string' || !clinicalPriority.trim()
      || typeof roomType !== 'string' || !roomType.trim()) {
    throw new Error('Choose a staff-assigned priority and required room type.');
  }
  const ids = new Set();
  for (const patient of patients) {
    if (typeof patient?.id !== 'string' || !patient.id.trim() || ids.has(patient.id)) {
      throw new Error('Patient IDs must be present and unique.');
    }
    ids.add(patient.id);
  }
  return patients
    .filter(patient => patient.status === 'waiting'
      && patient.clinicalPriority === clinicalPriority
      && patient.requiredRoomType === roomType)
    .map(patient => {
      if (typeof patient.waitingSince !== 'string'
          || !/(Z|[+-]\d{2}:\d{2})$/.test(patient.waitingSince)
          || !Number.isFinite(Date.parse(patient.waitingSince))) {
        throw new Error('Waiting patients need a valid waiting-since timestamp with a timezone.');
      }
      return { ...patient };
    })
    .sort((a, b) => Date.parse(a.waitingSince) - Date.parse(b.waitingSince)
      || a.id.localeCompare(b.id));
}
