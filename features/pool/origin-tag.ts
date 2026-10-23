/** "<Pool name> · <emoji> <pool lane name>": where a splash is or was in a pool. */
export function originTag(poolName: string, laneIcon: string | null, laneName: string): string {
  return `${poolName} · ${laneIcon ? `${laneIcon} ` : ''}${laneName}`;
}
