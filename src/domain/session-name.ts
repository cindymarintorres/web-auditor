const SESSION_NAME_RE = /^[a-zA-Z0-9_-]{1,50}$/;

export function isValidSessionName(name: unknown): name is string {
  return typeof name === 'string' && SESSION_NAME_RE.test(name);
}