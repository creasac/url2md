declare module "turndown" {
  export default class TurndownService {
    constructor(options?: Record<string, unknown>);
    turndown(input: string): string;
  }
}

declare module "turndown/lib/turndown.cjs.js" {
  export default class TurndownService {
    constructor(options?: Record<string, unknown>);
    turndown(input: string): string;
  }
}

declare module "../vendor/turndown.es.js" {
  export default class TurndownService {
    constructor(options?: Record<string, unknown>);
    turndown(input: string): string;
  }
}
