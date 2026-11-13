import { useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronRight, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { roomLabelKey, roomSubject } from './facilityRooms.ts'
import { roomHref, roomLabel } from './institutionData.ts'
import type { RoomRecord } from './institutionData.ts'
import { EMPTY_DETAILS } from './subjectDirectory.ts'
import type { SubjectDetails } from './subjectDirectory.ts'
import { ViewDialog } from './visuals.tsx'

const fields = [
  { key: 'room', label: '호실 이름', required: true, maxLength: 30 },
  { key: 'name', label: '대상자 이름', maxLength: 40 },
  { key: 'age', label: '나이 또는 연령대', pattern: '(?:[0-9]{1,2}|1[0-2][0-9]|130|[0-9]{2,3}대)', placeholder: '예: 30대', maxLength: 4 },
  { key: 'height', label: '키 (cm)', type: 'number', min: 1, max: 300, step: .1 },
  { key: 'weight', label: '몸무게 (kg)', type: 'number', min: 1, max: 500, step: .1 },
  { key: 'guardian', label: '보호자 이름', maxLength: 40 },
  { key: 'guardianPhone', label: '보호자 연락처', type: 'tel', maxLength: 30 },
] as const

export function RoomEditor({ room, rooms, save, close }: {
  room?: RoomRecord; rooms: RoomRecord[]; save: (details: SubjectDetails) => void; close: () => void
}) {
  const [details, setDetails] = useState<SubjectDetails>(() => room ? roomSubject(room) : EMPTY_DETAILS)
  const labelKey = roomLabelKey(details.room)
  const duplicate = rooms.some(entry => entry.id !== room?.id && roomLabelKey(roomLabel(entry)) === labelKey)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (labelKey && !duplicate) save(details)
  }

  return <ViewDialog title={room ? '호실·대상자 수정' : '호실 추가'} closeLabel="호실 양식 닫기" close={close}>
    <form className="subject-form" onSubmit={submit} autoComplete="off">
      <div className="subject-fields">
        {fields.map(({ key, label, ...input }) => <label key={key}>{label}
          <input {...input} value={details[key]} onChange={event => setDetails({ ...details, [key]: event.target.value })} />
        </label>)}
        <label>성별
          <select value={details.gender} onChange={event => setDetails({ ...details, gender: event.target.value })}>
            <option value="">선택 안 함</option><option>여성</option><option>남성</option><option>기타</option>
          </select>
        </label>
      </div>
      {duplicate && <p className="room-form-error" role="status">같은 이름의 호실이 이미 있습니다.</p>}
      <div className="subject-actions"><button type="button" className="subject-button" onClick={close}>취소</button>
        <button className="subject-button subject-primary" type="submit" disabled={!labelKey || duplicate}>저장</button></div>
    </form>
  </ViewDialog>
}

export function RoomDeleteDialog({ room, remove, close }: { room: RoomRecord; remove: () => void; close: () => void }) {
  return <ViewDialog title="호실 삭제" closeLabel="삭제 창 닫기" close={close}>
    <p className="subject-delete-copy"><strong>{roomLabel(room)}</strong>을 모니터링과 대상자 관리 목록에서 삭제할까요?</p>
    <div className="subject-actions"><button type="button" className="subject-button" onClick={close}>취소</button>
      <button type="button" className="subject-button subject-delete" onClick={remove}>삭제 확인</button></div>
  </ViewDialog>
}

export function Subjects({ rooms, add, edit, remove }: {
  rooms: RoomRecord[]; add: () => void; edit: (room: RoomRecord) => void; remove: (room: RoomRecord) => void
}) {
  return <main className="institution-page">
    <section className="institution-panel institution-room-panel" aria-labelledby="subject-list-title">
      <div className="institution-section-head"><h1 id="subject-list-title" tabIndex={-1}>대상자 관리</h1>
        <button type="button" className="institution-primary" onClick={add}><Plus size={16} />호실 추가</button>
      </div>
      <div className="institution-table-scroll"><table className="institution-table institution-subject-table">
        <thead><tr><th>호실</th><th>이름</th><th>관리</th></tr></thead>
        <tbody>{rooms.map(room => <tr key={room.id}>
          <th scope="row"><a className="institution-room-link" href={roomHref(room.id)}>{roomLabel(room)}</a></th>
          <td><a className="institution-room-link" href={roomHref(room.id)}><UserRound size={15} aria-hidden="true" />{room.name || '미배정'}<ChevronRight size={14} aria-hidden="true" /></a></td>
          <td><div className="subject-actions"><button type="button" className="institution-secondary" onClick={() => edit(room)} aria-label={`${roomLabel(room)} 수정`}><Pencil size={14} />수정</button>
            <button type="button" className="institution-secondary subject-danger" onClick={() => remove(room)} aria-label={`${roomLabel(room)} 삭제`}><Trash2 size={14} />삭제</button></div></td>
        </tr>)}{rooms.length === 0 && <tr><td colSpan={3} className="institution-empty">등록된 호실이 없습니다.</td></tr>}</tbody>
      </table></div>
      <p className="subjects-note">호실과 대상자 정보는 이 브라우저에 저장됩니다.</p>
    </section>
  </main>
}
