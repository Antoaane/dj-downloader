import { get, set } from 'idb-keyval'
export function useCache() {
  async function getMap(key: string) { return (await get(key)) as string | undefined }
  async function setMap(key: string, val: string) { await set(key, val) }
  return { getMap, setMap }
}
