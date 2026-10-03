/**
 * Almacén local (IndexedDB) de fondos subidos por el usuario.
 * Los archivos se guardan solo en este dispositivo/navegador.
 */

export interface StoredBackground {
  id: string
  name: string
  kind: 'image' | 'video'
  mimeType: string
  size: number
  blob: Blob
  createdAt: number
}

const DB_NAME = 'timebox-hub'
const DB_VERSION = 1
const STORE = 'backgrounds'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB no está disponible en este navegador.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la base local.'))
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode)
      const request = run(transaction.objectStore(STORE))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error ?? new Error('Error en la base local.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Operación cancelada.'))
    })
  } finally {
    db.close()
  }
}

export async function listStoredBackgrounds(): Promise<StoredBackground[]> {
  const rows = await withStore<StoredBackground[]>('readonly', (store) => store.getAll() as IDBRequest<StoredBackground[]>)
  return rows.sort((a, b) => a.createdAt - b.createdAt)
}

export async function putStoredBackground(background: StoredBackground): Promise<void> {
  await withStore('readwrite', (store) => store.put(background))
}

export async function deleteStoredBackground(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id))
}
