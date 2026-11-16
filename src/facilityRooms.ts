import { ROOMS, roomLabel } from './institutionData.ts'
import type { RoomRecord } from './institutionData.ts'
import { DEMO_SUBJECT_ID, EMPTY_DETAILS, readDirectory } from './subjectDirectory.ts'
import type { Subject, SubjectDetails } from './subjectDirectory.ts'

const STORAGE_KEY = 'carewave.institution.rooms.v1'
const EXPERIMENT_STORAGE_KEY = 'carewave.institution.experiment-rooms.v1'
const numberOrNull = (value: string) => value === '' ? null : Number(value)

function withoutGuardian(room: RoomRecord): RoomRecord {
  const { guardian, guardianPhone, ...roomDetails } = room
  return roomDetails
}

function readStoredRooms(storageKey: string): RoomRecord[] | undefined {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (!Array.isArray(saved)) return
    const rooms: RoomRecord[] = saved
    if (!rooms.some(room => 'guardian' in room || 'guardianPhone' in room)) return rooms
    const cleaned = rooms.map(withoutGuardian)
    try {
      localStorage.setItem(storageKey, JSON.stringify(cleaned))
    } catch { /* Ignore legacy contacts even if cleanup is blocked. */ }
    return cleaned
  } catch { /* Use the default rooms if browser storage is unavailable. */ }
}

function restoreTabContacts(rooms: RoomRecord[], key: string): RoomRecord[] {
  try {
    const contacts = JSON.parse(sessionStorage.getItem(key) ?? '{}')
    return rooms.map(room => {
      const contact = Object.hasOwn(contacts, room.id) ? contacts[room.id] : null
      if (!contact) return room
      return {
        ...room,
        guardian: typeof contact.guardian === 'string' ? contact.guardian : '',
        guardianPhone: typeof contact.guardianPhone === 'string' ? contact.guardianPhone : '',
      }
    })
  } catch { return rooms }
}

export function roomLabelKey(label: string) {
  return label.normalize('NFKC').trim().replace(/\s+/g, ' ').replace(/^(\d+)\s*호$/, '$1').toLowerCase()
}

export function roomSubject(room: RoomRecord): Subject {
  return { ...EMPTY_DETAILS, id: room.id, name: room.name, room: roomLabel(room), gender: room.gender,
    age: String(room.age ?? ''), height: String(room.height ?? ''), weight: String(room.weight ?? ''),
    guardian: room.guardian ?? '', guardianPhone: room.guardianPhone ?? '' }
}

export function updateRoom(details: SubjectDetails, room?: RoomRecord): RoomRecord {
  const label = details.room.trim()
  return {
    ...(room ?? { id: crypto.randomUUID(), level: 'unknown', occupied: false, online: false, reason: '아직 센서와 생활 기록이 연결되지 않았습니다.' }),
    label: /^\d+$/.test(label) ? `${label}호` : label,
    name: details.name.trim(), age: /^\d{2,3}대$/.test(details.age.trim()) ? details.age.trim() : numberOrNull(details.age.trim()), gender: details.gender,
    height: numberOrNull(details.height), weight: numberOrNull(details.weight),
    guardian: details.guardian.trim(), guardianPhone: details.guardianPhone.trim(),
  }
}

export function readFacilityRooms(initialRooms?: RoomRecord[]): RoomRecord[] {
  const standardRooms = readStoredRooms(STORAGE_KEY)
  const experimentRooms = readStoredRooms(EXPERIMENT_STORAGE_KEY)
  const legacySubjects = readDirectory().subjects
  const key = initialRooms ? EXPERIMENT_STORAGE_KEY : STORAGE_KEY
  const saved = initialRooms ? experimentRooms : standardRooms
  if (saved) {
    const updated = saved.map(room => {
      if (room.age != null || room.gender || room.height != null || room.weight != null) return room
      const initial = initialRooms?.find(entry => entry.id === room.id && entry.name === room.name)
      if (!initial) return room
      const { age, gender, height, weight } = initial
      return { ...room, age, gender, height, weight }
    })
    return restoreTabContacts(updated, key)
  }
  if (initialRooms) return restoreTabContacts(initialRooms.map(withoutGuardian), key)

  const rooms = [...ROOMS]
  for (const subject of legacySubjects) {
    if (subject.id === DEMO_SUBJECT_ID) continue
    const index = rooms.findIndex(room => roomLabelKey(roomLabel(room)) === roomLabelKey(subject.room))
    if (index >= 0) rooms[index] = updateRoom(subject, rooms[index])
    else rooms.push(updateRoom(subject, { id: subject.id, name: '', age: null, gender: '', height: null, weight: null,
      level: 'unknown', occupied: false, online: false, reason: '아직 센서와 생활 기록이 연결되지 않았습니다.' }))
  }
  return restoreTabContacts(rooms.map(withoutGuardian), key)
}

export function writeFacilityRooms(rooms: RoomRecord[], experiment = false) {
  const key = experiment ? EXPERIMENT_STORAGE_KEY : STORAGE_KEY
  localStorage.setItem(key, JSON.stringify(rooms.map(withoutGuardian)))
  const contacts = rooms.filter(room => room.guardian || room.guardianPhone)
    .map(({ id, guardian, guardianPhone }) => [id, { guardian, guardianPhone }])
  if (contacts.length) sessionStorage.setItem(key, JSON.stringify(Object.fromEntries(contacts)))
  else sessionStorage.removeItem(key)
}

export function roomRowSizes(count: number, columns: number) {
  const rowCount = Math.ceil(count / columns)
  const base = Math.floor(count / rowCount)
  const largerRows = count % rowCount
  return Array.from({ length: rowCount }, (_, row) => base + Number(row < largerRows))
}
