import { ROOM } from './room.ts'

export type SubjectDetails = {
  name: string
  room: string
  age: string
  gender: string
  height: string
  weight: string
  guardian: string
  guardianPhone: string
}

export type Subject = SubjectDetails & { id: string }
export type SubjectDirectory = { subjects: Subject[]; selectedId: string | null }

export const DEMO_SUBJECT_ID = 'carewave-demo-subject'
export const EMPTY_DETAILS: SubjectDetails = {
  name: '', room: '', age: '', gender: '', height: '', weight: '', guardian: '', guardianPhone: '',
}
export const DEMO_SUBJECT: Subject = { ...EMPTY_DETAILS, id: DEMO_SUBJECT_ID, name: ROOM.subject, room: ROOM.name }
const STORAGE_KEY = 'carewave.subjects.v1'

export function readDirectory(): SubjectDirectory {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const directory = JSON.parse(stored) as SubjectDirectory
      if (Array.isArray(directory.subjects)) {
        const selected = directory.subjects.find(subject => subject.id === directory.selectedId) ?? directory.subjects[0]
        return { subjects: directory.subjects, selectedId: selected?.id ?? null }
      }
    }
  } catch {
    // The demo is available when browser storage is unavailable.
  }
  return { subjects: [DEMO_SUBJECT], selectedId: DEMO_SUBJECT_ID }
}

export function writeDirectory(directory: SubjectDirectory) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(directory))
}
