const nextStatus = { assigned: 'en_route', en_route: 'in_progress', in_progress: 'completed' };

function timestamp(now) {
  if (typeof now !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(now) || !Number.isFinite(Date.parse(now))) {
    throw new Error('Provide a valid timestamp with a timezone.');
  }
  return new Date(now).toISOString();
}

export function advanceJob(job, technician, now) {
  const updatedAt = timestamp(now);
  if (!job?.id || job.technicianId !== technician?.id
      || technician.hasActiveJob !== true || technician.activeJobId !== job.id) {
    throw new Error('Job and assigned technician must match.');
  }
  if (!Object.hasOwn(nextStatus, job.status)) throw new Error('Job cannot advance from this status.');
  if (job.updatedAt && Date.parse(updatedAt) < Date.parse(job.updatedAt)) {
    throw new Error('Update time cannot precede the previous update.');
  }
  const status = nextStatus[job.status];
  const completed = status === 'completed';
  return {
    job: { ...job, status, updatedAt, ...(completed ? { completedAt: updatedAt } : {}) },
    technician: completed
      ? { ...technician, available: false, hasActiveJob: false, activeJobId: null, availabilityNeedsConfirmation: true }
      : { ...technician, available: false },
    notice: completed ? 'Job completed. Confirm availability before receiving another job.' : `Job status: ${status}.`,
  };
}

export function confirmAvailability(technician, now) {
  const confirmedAt = timestamp(now);
  if (!technician?.id || technician.hasActiveJob !== false || technician.activeJobId) {
    throw new Error('Technician must have no active job before confirming availability.');
  }
  return {
    ...technician,
    available: true,
    availabilityNeedsConfirmation: false,
    availabilityConfirmedAt: confirmedAt,
  };
}
