/** Treat persisted configuration and remote JSON as untrusted data. */
export function isRecord(value: unknown): value is Record<string, unknown> {
 return value !== null && typeof value === 'object' && !Array.isArray(value);
}
