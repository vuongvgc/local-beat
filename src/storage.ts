import type { Track } from "./music";
let database: Promise<IDBDatabase> | undefined;
function open() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("localbeat", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("tracks", { keyPath: "id" });
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        database = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      database = undefined;
      reject(new Error("Close other LocalBeat tabs and try again."));
    };
  });
  return database;
}
async function request<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("tracks", mode);
    const result = operation(transaction.objectStore("tracks"));
    transaction.oncomplete = () => resolve(result.result);
    transaction.onerror = transaction.onabort = () =>
      reject(
        transaction.error ?? result.error ?? new Error("Storage unavailable"),
      );
  });
}
export const musicStorage = {
  all: () => request("readonly", (store) => store.getAll()) as Promise<Track[]>,
  put: (track: Track) => request("readwrite", (store) => store.put(track)),
  remove: (id: string) => request("readwrite", (store) => store.delete(id)),
};
