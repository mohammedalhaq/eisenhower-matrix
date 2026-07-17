import type { ReactNode } from 'react'
import './Modal.css'

type ModalProps = {
  titleId: string
  className?: string
  onClose: () => void
  children: ReactNode
}

function Modal({ titleId, className = '', onClose, children }: ModalProps) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className={`task-modal${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {children}
      </section>
    </div>
  )
}

export default Modal
