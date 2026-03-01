/**
 * OneAgent SDK v4.2 - Resilience Utilities
 *
 * Provides retry logic with exponential backoff for LLM calls
 */

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms (default: 1000) */
  delayMs?: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Error patterns to retry on (default: common transient errors) */
  retryOn?: string[];
  /** Callback on each retry */
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  retryOn: [
    'rate_limit',
    '429',
    'timeout',
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'socket hang up',
    'overloaded',
    'too many requests',
  ],
};

/**
 * Execute a function with automatic retry on transient failures
 *
 * @example
 * const result = await withRetry(
 *   () => agent.generate({ prompt }),
 *   { maxAttempts: 3, onRetry: (n, err) => console.log(`Retry ${n}`) }
 * );
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const errorMessage = lastError.message.toLowerCase();

      // Check if error is retryable
      const isRetryable = config.retryOn.some((pattern) =>
        errorMessage.includes(pattern.toLowerCase())
      );

      if (!isRetryable) {
        console.warn(`[Retry] Non-retryable error, failing immediately:`, lastError.message);
        throw lastError;
      }

      if (attempt === config.maxAttempts) {
        console.warn(`[Retry] Max attempts (${config.maxAttempts}) reached, failing`);
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = config.delayMs * Math.pow(config.backoffMultiplier, attempt - 1);

      console.warn(
        `[Retry] Attempt ${attempt}/${config.maxAttempts} failed, retrying in ${delay}ms`
      );

      if (options.onRetry) {
        options.onRetry(attempt, lastError, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a circuit breaker for repeated failures
 * Opens after threshold failures, closes after cooldown
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening (default: 5) */
  failureThreshold?: number;
  /** Cooldown period in ms before attempting again (default: 30000) */
  cooldownMs?: number;
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private isOpen = false;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      cooldownMs: options.cooldownMs ?? 30000,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.isOpen) {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure < this.options.cooldownMs) {
        throw new Error(
          `Circuit breaker is open. Try again in ${Math.ceil((this.options.cooldownMs - timeSinceFailure) / 1000)}s`
        );
      }
      // Cooldown passed, try again (half-open state)
      console.warn('[CircuitBreaker] Cooldown passed, attempting recovery');
    }

    try {
      const result = await fn();
      // Success: reset failures
      this.failures = 0;
      this.isOpen = false;
      return result;
    } catch (err) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.options.failureThreshold) {
        this.isOpen = true;
        console.warn(`[CircuitBreaker] Opened after ${this.failures} failures`);
      }

      throw err;
    }
  }

  get state(): 'closed' | 'open' | 'half-open' {
    if (!this.isOpen) return 'closed';
    const timeSinceFailure = Date.now() - this.lastFailureTime;
    if (timeSinceFailure >= this.options.cooldownMs) return 'half-open';
    return 'open';
  }

  reset(): void {
    this.failures = 0;
    this.isOpen = false;
    this.lastFailureTime = 0;
  }
}
