import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { FileText, Loader2, UploadCloud, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import { formatBytes } from '../../lib/format'
import type { StoredAttachment } from '../../types'
import { Alert } from './Alert'
import { Button } from './Button'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const MAX_ATTACHMENTS = 5
export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg']
export const ACCEPT_HINT = ACCEPTED_EXTENSIONS.join(', ')

function extensionOf(name: string): string {
  const index = name.lastIndexOf('.')
  return index < 0 ? '' : name.slice(index).toLowerCase()
}

interface FileDropzoneProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string | null
  files: StoredAttachment[]
  onAdd: (stored: StoredAttachment) => void
  onRemove: (filename: string) => void
  disabled?: boolean
}

/**
 * Drag-and-drop + file-picker upload. Files go to the server immediately so the
 * complaint can be submitted with real attachments (SRS section 3 / section 6).
 */
export function FileDropzone({
  label = 'Attachments',
  hint,
  error,
  files,
  onAdd,
  onRemove,
  disabled = false,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const remainingSlots = MAX_ATTACHMENTS - files.length

  const upload = async (incoming: FileList | File[]) => {
    setLocalError(null)
    const list = Array.from(incoming)
    if (list.length === 0) return

    if (list.length > remainingSlots) {
      setLocalError(`You can attach at most ${MAX_ATTACHMENTS} files.`)
      return
    }

    const rejected = list.find((file) => {
      const extension = extensionOf(file.name)
      return file.size > MAX_UPLOAD_BYTES || !ACCEPTED_EXTENSIONS.includes(extension)
    })
    if (rejected) {
      setLocalError(
        `${rejected.name} was rejected — allowed types are ${ACCEPT_HINT}, up to ${formatBytes(MAX_UPLOAD_BYTES)} each.`,
      )
      return
    }

    const body = new FormData()
    for (const file of list) body.append('files', file)

    setBusy(true)
    try {
      const response = await api.post<{ files: StoredAttachment[] }>(
        '/complaints/attachments',
        body,
      )
      for (const stored of response.data.files) onAdd(stored)
    } catch (err) {
      setLocalError(getErrorMessage(err, 'Upload failed'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (disabled || busy) return
    void upload(event.dataTransfer.files)
  }

  const message = error ?? localError

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <span className="block text-[13px] font-semibold leading-tight text-ink">{label}</span>
        {hint && <p className="text-xs leading-snug text-muted">{hint}</p>}
      </div>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (!disabled && !busy) inputRef.current?.click()
        }}
        onKeyDown={(event) => {
          if (disabled || busy) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled && !busy) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
          dragging ? 'border-ink bg-brand-50' : 'border-border-strong bg-surface hover:border-ink/50',
          (disabled || busy) && 'pointer-events-none opacity-60',
        )}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin text-muted" aria-hidden="true" />
        ) : (
          <UploadCloud className="size-5 text-muted" aria-hidden="true" />
        )}
        <p className="text-sm font-medium text-ink">
          {busy ? 'Uploading…' : 'Drag files here, or click to browse'}
        </p>
        <p className="text-xs text-muted">
          {ACCEPT_HINT} — up to {formatBytes(MAX_UPLOAD_BYTES)} each, {MAX_ATTACHMENTS} files max
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          disabled={disabled || busy}
          onChange={(event) => {
            if (event.target.files) void upload(event.target.files)
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file) => (
            <li
              key={file.filename}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <FileText className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{file.original_name}</span>
              <span className="shrink-0 text-xs text-muted">
                {file.size ? formatBytes(file.size) : ''}
              </span>
              <button
                type="button"
                onClick={() => onRemove(file.filename)}
                disabled={disabled || busy}
                aria-label={`Remove ${file.original_name}`}
                className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-brand-50 hover:text-ink disabled:opacity-50"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && <Alert tone="error">{message}</Alert>}

      {files.length > 0 && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => files.forEach((file) => onRemove(file.filename))}
            disabled={disabled || busy}
          >
            Remove all
          </Button>
          <span className="text-xs text-muted">
            {files.length} of {MAX_ATTACHMENTS} attached
          </span>
        </div>
      )}
    </div>
  )
}
