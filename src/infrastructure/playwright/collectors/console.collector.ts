import type { Page } from 'playwright';

export class ConsoleCollector {
  private readonly consoleErrors: string[] = [];
  private readonly pageErrors: string[] = [];

  attach(page: Page): void {
    page.on('console', (msg) => {
      if (msg.type() === 'error') this.consoleErrors.push(msg.text().slice(0, 300));
    });
    page.on('pageerror', (err) => {
      this.pageErrors.push(String(err.message).slice(0, 300));
    });
  }

  result(): { consoleErrors: string[]; pageErrors: string[] } {
    return { consoleErrors: this.consoleErrors, pageErrors: this.pageErrors };
  }
}