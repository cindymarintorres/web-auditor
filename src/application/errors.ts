export class TooManyAuditsError extends Error {
  constructor() {
    super('Demasiadas auditorías en curso, intenta luego');
    this.name = 'TooManyAuditsError';
  }
}