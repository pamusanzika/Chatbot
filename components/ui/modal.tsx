'use client'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  width?: number
  children: React.ReactNode
}

export function Modal({ open, onClose, title, width = 440, children }: ModalProps) {
  if (!open) return null
  return (
    <div className="fb-modal-overlay" onClick={onClose}>
      <div className="fb-modal" style={{ width }} onClick={(e) => e.stopPropagation()}>
        <header className="fb-modal-head">
          <div className="fb-drawer-title">{title}</div>
          <button className="fb-iconbtn" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="fb-modal-body">{children}</div>
      </div>
    </div>
  )
}
