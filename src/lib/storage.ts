import {
  MAX_FILE_BYTES,
  SIGNED_URL_TTL_SECONDS,
  STORAGE_BUCKET,
} from './constants.ts'
import { createUuid } from './ids.ts'
import { supabase } from './supabase.ts'

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  // Documentos y hojas de cálculo
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  csv: 'text/csv',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  rtf: 'application/rtf',

  // Imágenes
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',

  // Audio y Video
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',

  // Código, lenguajes y datos
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  toml: 'text/plain',
  sql: 'text/plain',
  js: 'text/javascript',
  ts: 'text/plain',
  jsx: 'text/javascript',
  tsx: 'text/plain',
  py: 'text/x-python',
  c: 'text/x-c',
  cpp: 'text/x-c',
  h: 'text/x-c',
  hpp: 'text/x-c',
  cs: 'text/plain',
  ino: 'text/plain',
  html: 'text/html',
  css: 'text/css',
  sh: 'text/plain',
  bat: 'text/plain',
  ps1: 'text/plain',

  // Comprimidos y diagramas
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  drawio: 'application/xml',
}

export class AttachmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AttachmentError'
  }
}

function getExtension(fileName: string): string {
  const finalSegment = fileName.split(/[\\/]/).at(-1) ?? ''
  const dot = finalSegment.lastIndexOf('.')
  return dot < 0 ? '' : finalSegment.slice(dot + 1).toLowerCase()
}

export function getAttachmentMime(file: File): string {
  const extension = getExtension(file.name)
  const mime = MIME_BY_EXTENSION[extension] || file.type || 'application/octet-stream'
  if (file.size > MAX_FILE_BYTES) {
    throw new AttachmentError('Cada archivo debe pesar como máximo 25 MiB.')
  }
  return mime
}

/** Produce un nombre ASCII seguro para una clave de Supabase Storage. */
export function sanitizeFilename(fileName: string): string {
  const finalSegment = fileName.split(/[\\/]/).at(-1) ?? ''
  const normalized = finalSegment.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  const extension = getExtension(normalized)
  const baseName = extension ? normalized.slice(0, -(extension.length + 1)) : normalized
  const safeBase = baseName
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 100)
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)
  const fallback = `archivo-${createUuid()}`
  return `${safeBase || fallback}${safeExtension ? `.${safeExtension}` : ''}`
}

/** Sube un archivo nuevo; los nombres de objeto son únicos y no reemplazan versiones existentes. */
export async function uploadAttachment(userId: string, taskId: string, file: File): Promise<string> {
  const contentType = getAttachmentMime(file)
  const safeName = sanitizeFilename(file.name)
  const objectPath = `${userId}/${taskId}/${createUuid()}-${safeName}`
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(objectPath, file, {
    cacheControl: '3600',
    contentType,
    upsert: false,
  })
  if (error) throw new AttachmentError('No se pudo subir el archivo. Inténtalo de nuevo.')
  return objectPath
}

/** Genera una URL firmada breve para descargar un objeto del bucket privado. */
export async function getSignedUrl(objectPath: string, fileName: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, { download: fileName })
  if (error || !data?.signedUrl) {
    throw new AttachmentError('No se pudo preparar la descarga. Comprueba tus permisos e inténtalo de nuevo.')
  }
  return data.signedUrl
}

/** Genera una URL firmada para previsualización inline en la app (imágenes, video, audio, pdf, texto). */
export async function getPreviewSignedUrl(objectPath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    throw new AttachmentError('No se pudo generar la vista previa del archivo.')
  }
  return data.signedUrl
}

/** Elimina objetos únicamente a través de la API de Storage, nunca mediante DELETE SQL. */
export async function deleteAttachment(objectPath: string): Promise<void> {
  await deleteAttachments([objectPath])
}

export async function deleteAttachments(objectPaths: readonly string[]): Promise<void> {
  for (let offset = 0; offset < objectPaths.length; offset += 1000) {
    const batch = objectPaths.slice(offset, offset + 1000)
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([...batch])
    if (error) throw new AttachmentError('No se pudieron eliminar todos los archivos del almacenamiento.')
  }
}
