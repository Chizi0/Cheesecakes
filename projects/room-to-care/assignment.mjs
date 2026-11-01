import { waitingPatients } from './patient-queue.mjs';
import { assignRoom, canAssignRoom } from './room.mjs';

// clinicalPriority is explicitly chosen by staff; this function does not rank groups.
export function autoAssignPatient(room, patients, clinicalPriority) {
  if (typeof room?.id !== 'string' || !room.id.trim()
      || typeof room.roomType !== 'string' || !room.roomType.trim()) {
    throw new Error('Room needs an ID and room type.');
  }
  if (!canAssignRoom(room)) {
    return { assigned: false, room, patients, notice: 'No assignment: room is not available.' };
  }
  if (room.patientId || patients.some(patient => patient.status === 'assigned' && patient.roomId === room.id)) {
    throw new Error('Room already has a patient assignment.');
  }
  const queue = waitingPatients(patients, { clinicalPriority, roomType: room.roomType });
  if (!queue.length) {
    return { assigned: false, room, patients, notice: 'Room available—no eligible patient waiting.' };
  }
  const next = queue[0];
  if (next.roomId) throw new Error('Waiting patient already has a room assignment.');
  const result = assignRoom(room, next.id, 'Automatic assignment');
  return {
    assigned: true,
    room: result.room,
    patients: patients.map(patient => patient.id === next.id
      ? { ...patient, status: 'assigned', roomId: room.id }
      : { ...patient }),
    notice: `Patient ${next.id} automatically assigned to room ${room.id}.`,
  };
}
