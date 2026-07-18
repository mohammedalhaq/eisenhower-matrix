import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import Modal from './Modal'
import './App.css'

type QuadrantId = 'do' | 'schedule' | 'delegate' | 'delete'

type Task = {
  id: string
  text: string
  quadrant: QuadrantId
  completed: boolean
  createdAt: number
}

const STORAGE_KEY = 'eisenhower.tasks.v1'

const quadrants: Array<{
  id: QuadrantId
  title: string
  label: string
  description: string
}> = [
  { id: 'do', title: 'Do first', label: 'Urgent & important', description: 'Handle these now.' },
  { id: 'schedule', title: 'Schedule', label: 'Important, not urgent', description: 'Make time for these.' },
  { id: 'delegate', title: 'Delegate', label: 'Urgent, not important', description: 'Handle lightly, hand off, or respond later.' },
  { id: 'delete', title: 'Eliminate', label: 'Not urgent or important', description: 'Let these go.' },
]

type TaskItemProps = {
  task: Task
  editing: boolean
  editingText: string
  onToggle: () => void
  onStartEditing: () => void
  onEditingTextChange: (text: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onMove: (quadrant: QuadrantId) => void
  onDelete: () => void
}

function TaskItem({ task, editing, editingText, onToggle, onStartEditing, onEditingTextChange, onSaveEdit, onCancelEdit, onMove, onDelete }: TaskItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style: CSSProperties | undefined = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  return (
    <li ref={setNodeRef} style={style} className={`${task.completed ? 'completed ' : ''}${isDragging ? 'dragging' : ''}`}>
      <button className="drag-handle" type="button" aria-label={`Drag ${task.text}`} {...listeners} {...attributes}>
        <svg viewBox="0 0 12 18" aria-hidden="true">
          <circle cx="3" cy="3" r="1.5" />
          <circle cx="9" cy="3" r="1.5" />
          <circle cx="3" cy="9" r="1.5" />
          <circle cx="9" cy="9" r="1.5" />
          <circle cx="3" cy="15" r="1.5" />
          <circle cx="9" cy="15" r="1.5" />
        </svg>
      </button>
      <button className="check" onClick={onToggle} aria-label={task.completed ? `Mark ${task.text} incomplete` : `Mark ${task.text} complete`}>
        {task.completed ? 'Done' : 'Open'}
      </button>
      {editing ? (
        <input
          className="edit-input"
          value={editingText}
          onChange={(event) => onEditingTextChange(event.target.value)}
          onBlur={onSaveEdit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSaveEdit()
            if (event.key === 'Escape') onCancelEdit()
          }}
          autoFocus
        />
      ) : (
        <button className="task-text" onClick={onStartEditing}>{task.text}</button>
      )}
      <select value={task.quadrant} onChange={(event) => onMove(event.target.value as QuadrantId)} aria-label={`Move ${task.text}`}>
        {quadrants.map((destination) => <option key={destination.id} value={destination.id}>{destination.title}</option>)}
      </select>
      <button className="remove" onClick={onDelete} aria-label={`Delete ${task.text}`}>Remove</button>
    </li>
  )
}

function QuadrantDropZone({ id, className, children }: { id: QuadrantId, className: string, children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: `quadrant-${id}`, data: { quadrant: id } })

  return <article ref={setNodeRef} className={`${className}${isOver ? ' drag-over' : ''}`}>{children}</article>
}

function readTasks(): Task[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskText, setTaskText] = useState('')
  const [selectedQuadrant, setSelectedQuadrant] = useState<QuadrantId>('do')
  const [modalQuadrant, setModalQuadrant] = useState<QuadrantId | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [modalTaskText, setModalTaskText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [tasksLoaded, setTasksLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  )

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return

      setTasks(readTasks())
      setTasksLoaded(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!tasksLoaded) return

    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks, tasksLoaded])

  function addTask(event: FormEvent) {
    event.preventDefault()
    const text = taskText.trim()
    if (!text) return

    setTasks((current) => [
      ...current,
      { id: crypto.randomUUID(), text, quadrant: selectedQuadrant, completed: false, createdAt: Date.now() },
    ])
    setTaskText('')
    inputRef.current?.focus()
  }

  function addQuadrantTask(event: FormEvent) {
    event.preventDefault()
    const text = modalTaskText.trim()
    if (!text || !modalQuadrant) return

    setTasks((current) => [
      ...current,
      { id: crypto.randomUUID(), text, quadrant: modalQuadrant, completed: false, createdAt: Date.now() },
    ])
    closeTaskModal()
  }

  function closeTaskModal() {
    setModalQuadrant(null)
    setModalTaskText('')
  }

  function toggleTask(id: string) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task))
  }

  function deleteTask(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  function moveTask(id: string, quadrant: QuadrantId) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, quadrant } : task))
  }

  function handleDragEnd(event: DragEndEvent) {
    const quadrant = event.over?.data.current?.quadrant as QuadrantId | undefined
    if (quadrant) moveTask(String(event.active.id), quadrant)
  }

  function startEditing(task: Task) {
    setEditingId(task.id)
    setEditingText(task.text)
  }

  function saveEdit(id: string) {
    const text = editingText.trim()
    if (text) {
      setTasks((current) => current.map((task) => task.id === id ? { ...task, text } : task))
    }
    setEditingId(null)
  }

  const openCount = tasks.filter((task) => !task.completed).length
  const selectedModalQuadrant = quadrants.find((quadrant) => quadrant.id === modalQuadrant)

  return (
    <main>
      <section className="intro" id="top">
        <p className="eyebrow">Decide what matters</p>
        <h1>Make time for<br /><em>the right things.</em></h1>
        <p className="task-summary">
          You have <strong>{openCount}</strong> open {openCount === 1 ? 'task' : 'tasks'}
        </p>
        <p className="lede">
          Your tasks are only saved <i>locally</i> in this browser.{' '}
          <button className="text-link" type="button" onClick={() => setShowExplanation(true)}>
            What is an Eisenhower matrix?
          </button>
        </p>
      </section>

      <form className="composer" onSubmit={addTask}>
        <label htmlFor="new-task">Add a task</label>
        <div className="composer-row">
          <input
            id="new-task"
            ref={inputRef}
            value={taskText}
            onChange={(event) => setTaskText(event.target.value)}
            placeholder="What needs your attention?"
            autoComplete="off"
          />
          <select value={selectedQuadrant} onChange={(event) => setSelectedQuadrant(event.target.value as QuadrantId)} aria-label="Choose quadrant">
            {quadrants.map((quadrant) => <option key={quadrant.id} value={quadrant.id}>{quadrant.title}</option>)}
          </select>
          <button type="submit">Add task</button>
        </div>
      </form>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <section className="matrix-scale" aria-label="Eisenhower matrix scale">
        <div className="axis-label axis-y axis-y-important">Important</div>
        <div className="axis-label axis-y axis-y-not-important">Not important</div>
        <div className="axis-label axis-x axis-x-urgent">Urgent</div>
        <div className="axis-label axis-x axis-x-not-urgent">Not urgent</div>
        <section className="matrix" aria-label="Eisenhower matrix">
          {quadrants.map((quadrant) => {
            const quadrantTasks = tasks.filter((task) => task.quadrant === quadrant.id)
            return (
              <QuadrantDropZone id={quadrant.id} className={`quadrant quadrant-${quadrant.id}`} key={quadrant.id}>
                <div className="quadrant-heading">
                  <div>
                    <p>{quadrant.label}</p>
                    <h2>{quadrant.title}</h2>
                  </div>
                  <div className="quadrant-actions">
                    <b>{quadrantTasks.length}</b>
                    <button className="quadrant-add" type="button" onClick={() => setModalQuadrant(quadrant.id)} aria-label={`Add task to ${quadrant.title}`}>
                      +
                    </button>
                  </div>
                </div>
                <p className="quadrant-description">{quadrant.description}</p>

                <ul className="task-list">
                  {quadrantTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      editing={editingId === task.id}
                      editingText={editingText}
                      onToggle={() => toggleTask(task.id)}
                      onStartEditing={() => startEditing(task)}
                      onEditingTextChange={setEditingText}
                      onSaveEdit={() => saveEdit(task.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onMove={(destination) => moveTask(task.id, destination)}
                      onDelete={() => deleteTask(task.id)}
                    />
                  ))}
                </ul>

                {quadrantTasks.length === 0 && <p className="empty">Nothing here yet.</p>}
              </QuadrantDropZone>
            )
          })}
        </section>
      </section>
      </DndContext>

      {selectedModalQuadrant && (
        <Modal titleId="task-modal-title" onClose={closeTaskModal}>
          <p className="eyebrow">{selectedModalQuadrant.label}</p>
          <h2 id="task-modal-title">Add to {selectedModalQuadrant.title}</h2>
          <form onSubmit={addQuadrantTask}>
            <label htmlFor="modal-task">Task</label>
            <input
              id="modal-task"
              value={modalTaskText}
              onChange={(event) => setModalTaskText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeTaskModal()
              }}
              placeholder="What needs your attention?"
              autoComplete="off"
              autoFocus
            />
            <div className="modal-actions">
              <button type="button" onClick={closeTaskModal}>Cancel</button>
              <button type="submit">Add task</button>
            </div>
          </form>
        </Modal>
      )}

      {showExplanation && (
        <Modal titleId="matrix-modal-title" className="info-modal" onClose={() => setShowExplanation(false)}>
          <p className="eyebrow">How it works</p>
          <h2 id="matrix-modal-title">The Eisenhower matrix</h2>
          <p>
            An Eisenhower matrix helps you sort work by urgency and importance, so your next action is clearer.
          </p>
          <ul>
            <li><strong>Do first:</strong> urgent and important tasks that need attention now.</li>
            <li><strong>Schedule:</strong> important tasks that deserve protected time later.</li>
            <li><strong>Delegate:</strong> urgent-feeling tasks that matter, but will not derail you if handled lightly, handed off, or answered later.</li>
            <li><strong>Eliminate:</strong> tasks that are neither urgent nor important.</li>
          </ul>
          <div className="modal-actions">
            <button type="button" onClick={() => setShowExplanation(false)}>Close</button>
          </div>
        </Modal>
      )}

      <footer>
        <p>Your tasks never leave this browser.</p>
        {tasks.length > 0 && <button onClick={() => setTasks([])}>Clear all tasks</button>}
      </footer>
    </main>
  )
}

export default App
