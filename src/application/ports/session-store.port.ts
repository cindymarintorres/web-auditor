export interface SessionStore {
  exists(name: string): boolean;
  /** Devuelve el estado guardado (JSON serializado: cookies + localStorage). */
  read(name: string): Promise<string>;
}