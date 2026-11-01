// Operations prototype: these are workflow states, not clinical assessments.
const transitions = {
  occupied: { patient_left: 'needs_cleaning' },
  needs_cleaning: { start_cleaning: 'being_cleaned' },
  being_cleaned: { confirm_ready: 'available' },
  available: {},
};

export function transitionRoom(room, action, staffName) {
  if (!room || !Object.hasOwn(transitions, room.status)) {
    throw new Error('Room status is not recognized.');
  }
  if (typeof staffName !== 'string' || !staffName.trim()) {
    throw new Error('A staff name is required to record this update.');
  }
  const allowed = transitions[room.status];
  if (!Object.hasOwn(allowed, action)) {
    throw new Error(`Cannot ${action} while the room is ${room.status}.`);
  }

  return {
    ...room,
    status: allowed[action],
    ...(action === 'patient_left' ? { patientId: null } : {}),
    updatedBy: staffName.trim(),
  };
}

export function canAssignRoom(room) {
  return room?.status === 'available';
}

export function assignRoom(room, patientId, staffName) {
  if (!room || !Object.hasOwn(transitions, room.status)) {
    throw new Error('Room status is not recognized.');
  }
  if (room.status === 'being_cleaned') {
    return { success: false, message: 'Room unavailable - still cleaning', room };
  }
  if (!canAssignRoom(room)) {
    return { success: false, message: 'Room unavailable', room };
  }
  if (typeof patientId !== 'string' || !patientId.trim()) {
    throw new Error('A patient ID is required.');
  }
  if (typeof staffName !== 'string' || !staffName.trim()) {
    throw new Error('A staff name is required to record this update.');
  }
  return {
    success: true,
    message: 'Patient assigned',
    room: { ...room, status: 'occupied', patientId: patientId.trim(), updatedBy: staffName.trim() },
  };
}
