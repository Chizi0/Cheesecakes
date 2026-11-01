import { selectCleaner } from './cleaners.mjs';
import { transitionRoom } from './room.mjs';

function timestamp(now) {
  if (typeof now !== 'string' || !Number.isFinite(Date.parse(now))) {
    throw new Error('Provide a valid timestamp.');
  }
  return new Date(now).toISOString();
}

export function assignCleaning(room, cleaners, now) {
  const assignedAt = timestamp(now);
  if (room.status !== 'needs_cleaning') throw new Error('Room must need cleaning before assignment.');
  if (room.cleaningTask?.cleanerId) throw new Error('Room already has a cleaning assignment.');
  const cleaner = selectCleaner(cleaners);
  if (!cleaner) {
    return {
      assigned: false,
      room: { ...room, awaitingCleaner: true },
      cleaners: cleaners.map(person => ({ ...person })),
      message: 'Awaiting cleaner',
    };
  }
  if (cleaner.lastAssignedAt && Date.parse(assignedAt) < Date.parse(cleaner.lastAssignedAt)) {
    throw new Error('Assignment time cannot precede the previous assignment.');
  }
  return {
    assigned: true,
    room: {
      ...room,
      awaitingCleaner: false,
      cleaningTask: { cleanerId: cleaner.id, assignedAt, startedAt: null },
    },
    cleaners: cleaners.map(person => person.id === cleaner.id
      ? { ...person, hasActiveTask: true, activeRoomId: room.id, lastAssignedAt: assignedAt }
      : { ...person }),
    message: `Assigned to ${cleaner.id}`,
  };
}

export function startAssignedCleaning(room, cleaners, cleanerId, now) {
  const startedAt = timestamp(now);
  if (room.status !== 'needs_cleaning') throw new Error('Room is not waiting for cleaning to start.');
  const task = room.cleaningTask;
  if (!task || task.cleanerId !== cleanerId) throw new Error('Only the assigned cleaner can start this task.');
  const cleaner = cleaners.find(person => person.id === cleanerId);
  if (!cleaner || !cleaner.hasActiveTask || cleaner.activeRoomId !== room.id) {
    throw new Error('Cleaner reservation does not match this room.');
  }
  if (cleaner.onShift !== true || cleaner.onBreak !== false) {
    throw new Error('Cleaner must be on shift and off break to start.');
  }
  if (Date.parse(startedAt) < Date.parse(task.assignedAt)) throw new Error('Start time cannot precede assignment.');
  return {
    ...transitionRoom(room, 'start_cleaning', cleanerId),
    cleaningTask: { ...task, startedAt },
  };
}

export function assignmentToStartMinutes(room) {
  const task = room.cleaningTask;
  if (!task?.startedAt) return null;
  return (Date.parse(task.startedAt) - Date.parse(task.assignedAt)) / 60000;
}

export function completeCleaning(room, cleaners, cleanerId, now) {
  const completedAt = timestamp(now);
  const task = room.cleaningTask;
  if (room.status !== 'being_cleaned' || !task?.startedAt) {
    throw new Error('Cleaning must start before the room can be confirmed ready.');
  }
  if (task.cleanerId !== cleanerId) throw new Error('Only the assigned cleaner can complete this task.');
  const cleaner = cleaners.find(person => person.id === cleanerId);
  if (!cleaner || cleaner.hasActiveTask !== true || cleaner.activeRoomId !== room.id) {
    throw new Error('Cleaner reservation does not match this room.');
  }
  if (Date.parse(completedAt) < Date.parse(task.startedAt)) {
    throw new Error('Completion time cannot precede cleaning start.');
  }
  const completedTask = {
    ...task,
    completedAt,
    confirmedBy: cleanerId,
    assignmentToStartMinutes: assignmentToStartMinutes(room),
    cleaningMinutes: (Date.parse(completedAt) - Date.parse(task.startedAt)) / 60000,
  };
  return {
    room: {
      ...transitionRoom(room, 'confirm_ready', cleanerId),
      cleaningTask: null,
      cleaningHistory: [...(room.cleaningHistory ?? []), completedTask],
    },
    cleaners: cleaners.map(person => person.id === cleanerId
      ? { ...person, hasActiveTask: false, activeRoomId: null }
      : { ...person }),
    message: 'Room confirmed ready',
  };
}
