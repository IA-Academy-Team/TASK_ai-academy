import type { Response } from "express";

// Conexiones SSE activas por usuario, en memoria — alcanza para un solo
// proceso Node (no hay balanceo horizontal en este despliegue).
const subscribers = new Map<string, Set<Response>>();

export function subscribe(userId: string, res: Response): void {
  const set = subscribers.get(userId) ?? new Set<Response>();
  set.add(res);
  subscribers.set(userId, set);
}

export function unsubscribe(userId: string, res: Response): void {
  const set = subscribers.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) subscribers.delete(userId);
}

export function publish(userId: string, event: string, data: unknown): void {
  const set = subscribers.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    res.write(payload);
  }
}
