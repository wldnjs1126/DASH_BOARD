import { useState } from 'react'
import type { FormEvent } from 'react'
import { MapPin, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { EMPTY_DETAILS } from './subjectDirectory.ts'
import type { Subject, SubjectDetails } from './subjectDirectory.ts'
import { ViewDialog } from './visuals.tsx'

const fields = [
  { key: 'name', label: '이름', required: true, maxLength: 40 },
  { key: 'room', label: '호실', required: true, maxLength: 30 },
  { key: 'age', label: '나이 (세)', type: 'number', min: 0, max: 130, step: 1 },
  { key: 'height', label: '키 (cm)', type: 'number', min: 1, max: 300, step: .1 },
  { key: 'weight', label: '몸무게 (kg)', type: 'number', min: 1, max: 500, step: .1 },
  { key: 'guardian', label: '보호자 이름', maxLength: 40 },
  { key: 'guardianPhone', label: '보호자 연락처', type: 'tel', maxLength: 30 },
] as const

function SubjectForm({ subject, save, close }: { subject?: Subject; save: (details: SubjectDetails) => void; close: () => void }) {
  const [details, setDetails] = useState<SubjectDetails>(subject ?? EMPTY_DETAILS)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!details.name.trim() || !details.room.trim()) return
    save({ ...details, name: details.name.trim(), room: details.room.trim(), guardian: details.guardian.trim(), guardianPhone: details.guardianPhone.trim() })
  }

  return <form className="subject-form" onSubmit={submit} autoComplete="off">
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
    <div className="subject-actions"><button type="button" className="subject-button" onClick={close}>취소</button>
      <button className="subject-button subject-primary" type="submit" disabled={!details.name.trim() || !details.room.trim()}>저장</button></div>
  </form>
}

export function Subjects({ subjects, selected, select, save, remove }: {
  subjects: Subject[]; selected: Subject | null; select: (id: string) => void
  save: (details: SubjectDetails, id?: string) => void; remove: (id: string) => void
}) {
  const [editor, setEditor] = useState<'new' | Subject | null>(null)
  const [deleting, setDeleting] = useState<Subject | null>(null)
  const closeEditor = () => setEditor(null)
  const values = selected && [
    ['호실', selected.room], ['나이', selected.age && `${selected.age}세`], ['성별', selected.gender],
    ['키', selected.height && `${selected.height} cm`], ['몸무게', selected.weight && `${selected.weight} kg`],
    ['보호자 이름', selected.guardian], ['보호자 연락처', selected.guardianPhone],
  ]

  return <main className="subjects-page">
    <div className="subjects-heading">
      <h1 tabIndex={-1}>대상자 정보</h1>
      <button type="button" className="subject-button subject-primary" onClick={() => setEditor('new')}><Plus size={17} />대상자 등록</button>
    </div>
    <p className="subjects-note">등록 정보는 이 브라우저에 저장됩니다. 공유용 화면에서는 시연용 정보를 입력해 주세요.</p>
    {selected && values ? <div className="subjects-grid">
      <section className="panel subject-list" aria-label="대상자 목록">
        <h2>대상자 목록 <small>{subjects.length}명</small></h2>
        <ul>{subjects.map(subject => <li key={subject.id}><button type="button" aria-pressed={selected.id === subject.id} onClick={() => select(subject.id)}>
          <UserRound size={18} aria-hidden="true" /><span><strong>{subject.name}</strong><small>{subject.room}</small></span>
        </button></li>)}</ul>
      </section>
      <section className="panel subject-profile" aria-label="선택한 대상자 정보">
        <div className="subject-profile-heading"><div className="subject-identity">
          <span className="report-subject-icon"><UserRound size={23} aria-hidden="true" /></span>
          <div><h2>{selected.name}</h2><p><MapPin size={14} aria-hidden="true" />{selected.room}</p></div>
        </div><div className="subject-actions">
          <button type="button" className="subject-button" onClick={() => setEditor(selected)}><Pencil size={15} />수정</button>
          <button type="button" className="subject-button subject-danger" onClick={() => setDeleting(selected)}><Trash2 size={15} />삭제</button>
        </div></div>
        <dl className="subject-details">{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
      </section>
    </div> : <section className="panel subject-empty"><UserRound size={25} /><h2>등록된 대상자가 없습니다</h2><p>대상자를 등록하면 모니터링과 생활 리포트에서 선택할 수 있습니다.</p></section>}
    {editor && <ViewDialog title={editor === 'new' ? '대상자 등록' : '대상자 정보 수정'} closeLabel="대상자 양식 닫기" close={closeEditor}>
      <SubjectForm subject={editor === 'new' ? undefined : editor} close={closeEditor} save={details => {
        save(details, editor === 'new' ? undefined : editor.id)
        closeEditor()
      }} />
    </ViewDialog>}
    {deleting && <ViewDialog title="대상자 삭제" closeLabel="삭제 창 닫기" close={() => setDeleting(null)}>
      <p className="subject-delete-copy"><strong>{deleting.name}</strong> 대상자 정보를 이 브라우저에서 삭제할까요?</p>
      <div className="subject-actions"><button type="button" className="subject-button" onClick={() => setDeleting(null)}>취소</button>
        <button type="button" className="subject-button subject-delete" onClick={() => { remove(deleting.id); setDeleting(null) }}>삭제 확인</button></div>
    </ViewDialog>}
  </main>
}
