"use client"

// Bulk photo picker for the media library. Phone-first: "Choose photos" /
// "Take a photo" buttons plus a desktop drop zone, per-file progress, honest
// errors via explainUploadError, and a wake lock so the screen doesn't sleep
// mid-upload. Mirrors the patterns in
// app/admin/(authed)/portfolio/bulk-upload/bulk-upload-client.tsx but is
// upload-only — no painting fields, just files in, URLs out.

import { useCallback, useEffect, useRef, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Loader2, AlertCircle, RefreshCw, Upload, Camera, Info, Check } from "lucide-react"
import { uploadImage, type UploadResult } from "@/lib/storage/upload"
import { explainUploadError, isHeicFile } from "@/lib/upload-errors"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]

const MAX_CONCURRENT =
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches ? 2 : 4

type FileStatus = "queued" | "uploading" | "done" | "error"

interface UploadItem {
  id: string
  file: File
  status: FileStatus
  progress: number
  result: UploadResult | null
  error: string | null
  errorDetail: string | null
  showDetail: boolean
}

function makeItem(file: File): UploadItem {
  return {
    id: crypto.randomUUID(),
    file,
    status: "queued",
    progress: 0,
    result: null,
    error: null,
    errorDetail: null,
    showDetail: false,
  }
}

export interface MultiFileUploaderProps {
  bucket: "paintings" | "site-images" | "events" | "headshots"
  onDone: (results: { url: string; path: string }[]) => void
}

export function MultiFileUploader({ bucket, onDone }: MultiFileUploaderProps) {
  const [items, setItems] = useState<UploadItem[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const queueRef = useRef<UploadItem[]>([])
  const activeCountRef = useRef(0)
  const drainRef = useRef<() => void>(() => {})

  const uploadOne = useCallback(
    async (item: UploadItem) => {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "uploading" as const, progress: 0 } : i))
      )
      try {
        const result = await uploadImage(bucket, item.file, {
          onProgress: (pct) => {
            setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, progress: pct } : i)))
          },
        })
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "done" as const, progress: 100, result } : i
          )
        )
      } catch (e) {
        const { headline, detail } = explainUploadError(e)
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "error" as const, error: headline, errorDetail: detail }
              : i
          )
        )
      } finally {
        activeCountRef.current--
        drainRef.current()
      }
    },
    [bucket]
  )

  const drainQueue = useCallback(() => {
    while (activeCountRef.current < MAX_CONCURRENT && queueRef.current.length > 0) {
      const item = queueRef.current.shift()!
      activeCountRef.current++
      void uploadOne(item)
    }
  }, [uploadOne])

  useEffect(() => {
    drainRef.current = drainQueue
  }, [drainQueue])

  const enqueueFiles = useCallback(
    (files: File[]) => {
      const heicFiles = files.filter(isHeicFile)
      const images = files.filter((f) => !isHeicFile(f) && ACCEPTED_TYPES.includes(f.type))

      if (heicFiles.length > 0) {
        setItems((prev) => [
          ...prev,
          ...heicFiles.map((f) => ({
            ...makeItem(f),
            status: "error" as const,
            error: "HEIC isn't supported",
            errorDetail: "iPhone: Settings → Camera → Formats → Most Compatible, then try again.",
          })),
        ])
      }

      if (images.length === 0) return
      const newItems = images.map(makeItem)
      setItems((prev) => [...prev, ...newItems])
      queueRef.current.push(...newItems)
      drainQueue()
    },
    [drainQueue]
  )

  const onDrop = useCallback((accepted: File[]) => enqueueFiles(accepted), [enqueueFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: true,
  })

  function handlePhotoInput(e: React.ChangeEvent<HTMLInputElement>) {
    enqueueFiles(Array.from(e.target.files ?? []))
    e.target.value = ""
  }

  function retryItem(id: string) {
    const item = items.find((i) => i.id === id)
    if (!item || item.status !== "error") return
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: "queued" as const, error: null, errorDetail: null, progress: 0 } : i
      )
    )
    queueRef.current.push(item)
    drainQueue()
  }

  function retryAllFailed() {
    const failed = items.filter((i) => i.status === "error")
    if (failed.length === 0) return
    setItems((prev) =>
      prev.map((i) =>
        i.status === "error"
          ? { ...i, status: "queued" as const, error: null, errorDetail: null, progress: 0 }
          : i
      )
    )
    queueRef.current.push(...failed)
    drainQueue()
  }

  function toggleDetail(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, showDetail: !i.showDetail } : i)))
  }

  // Wake lock while anything is uploading/queued.
  const busyCount = items.filter((i) => i.status === "uploading" || i.status === "queued").length
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  useEffect(() => {
    let cancelled = false
    async function sync() {
      if (busyCount > 0) {
        if (!wakeLockRef.current && "wakeLock" in navigator) {
          try {
            const lock = await navigator.wakeLock.request("screen")
            if (cancelled) lock.release().catch(() => {})
            else wakeLockRef.current = lock
          } catch {
            // non-fatal
          }
        }
      } else if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
      }
    }
    void sync()
    return () => {
      cancelled = true
    }
  }, [busyCount])

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") drainRef.current()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  const doneCount = items.filter((i) => i.status === "done").length
  const errorCount = items.filter((i) => i.status === "error").length
  const hasItems = items.length > 0

  useEffect(() => {
    if (hasItems && busyCount === 0 && doneCount > 0 && doneCount === items.length) {
      onDone(items.map((i) => ({ url: i.result!.url, path: i.result!.path })))
    }
    // Only fire when the batch fully settles into all-done.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busyCount, doneCount, items.length])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" className="h-11 text-sm" onClick={() => photoInputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-2" />
          Choose photos
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 text-sm"
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="h-4 w-4 mr-2" />
          Take a photo
        </Button>
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handlePhotoInput}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        capture="environment"
        className="sr-only"
        onChange={handlePhotoInput}
      />

      <div
        {...getRootProps()}
        className={cn(
          "hidden sm:block border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-muted/40"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Upload className="h-4 w-4 shrink-0" />
          <span>Or drop images here</span>
        </div>
      </div>

      {hasItems && (
        <>
          <p className="text-xs text-muted-foreground">
            {doneCount} of {items.length} uploaded
            {errorCount > 0 && ` · ${errorCount} failed`}
          </p>

          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-2 border border-border rounded-md px-2 py-1.5 text-xs",
                  item.status === "error" && "border-destructive/50 bg-destructive/5"
                )}
              >
                <span className="flex-1 min-w-0 truncate">{item.file.name}</span>

                {item.status === "queued" && (
                  <span className="text-muted-foreground shrink-0">Waiting…</span>
                )}
                {item.status === "uploading" && (
                  <span className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading {item.progress}%
                  </span>
                )}
                {item.status === "done" && (
                  <span className="flex items-center gap-1 text-foreground shrink-0">
                    <Check className="h-3 w-3" />
                    Done
                  </span>
                )}
                {item.status === "error" && (
                  <span className="flex items-center gap-1 text-destructive shrink-0">
                    <AlertCircle className="h-3 w-3" />
                    {item.error}
                    {item.errorDetail && (
                      <button
                        type="button"
                        onClick={() => toggleDetail(item.id)}
                        className="text-destructive/70 hover:text-destructive"
                        aria-label="Show details"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => retryItem(item.id)}
                      className="ml-1 underline underline-offset-2 hover:text-destructive"
                    >
                      Retry
                    </button>
                  </span>
                )}

                {item.status === "uploading" && (
                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-muted overflow-hidden" />
                )}
              </div>
            ))}
          </div>

          {items.map((item) =>
            item.status === "error" && item.showDetail && item.errorDetail ? (
              <p key={`detail-${item.id}`} className="text-[10px] text-destructive/80 -mt-1">
                {item.file.name}: {item.errorDetail}
              </p>
            ) : null
          )}

          {errorCount > 0 && busyCount === 0 && (
            <Button size="sm" variant="outline" onClick={retryAllFailed}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Retry failed
            </Button>
          )}
        </>
      )}
    </div>
  )
}
