// Prototype inputs are supplied records, not verified credentials.
export function checkCertification(technician, job) {
  if (typeof job?.requiredCertification !== 'string' || !job.requiredCertification.trim()) {
    throw new Error('The job needs a required certification.');
  }
  if (!Array.isArray(technician?.certifications)) {
    return { qualified: false, reason: 'Certification information needs verification.' };
  }
  const qualified = technician.certifications.includes(job.requiredCertification);
  return {
    qualified,
    reason: qualified
      ? 'Required certification is listed.'
      : 'Required certification is missing.',
  };
}
