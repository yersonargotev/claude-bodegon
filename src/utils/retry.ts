import type { RetryConfig } from '../agents/types.js';

/**
 * Error personalizado para reintentos agotados
 */
export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

/**
 * Interfaz para estrategia de retry
 */
export interface IRetryStrategy {
  shouldRetry(attempt: number, error: Error): boolean;
  getDelay(attempt: number): number;
  onRetry?(attempt: number, error: Error, delay: number): void;
  onSuccess?(attempt: number): void;
  onFailure?(attempts: number, lastError: Error): void;
}

/**
 * Implementación de estrategia de retry con backoff exponencial
 */
class ExponentialBackoffRetryImpl implements IRetryStrategy {
  constructor(private config: RetryConfig) {}

  shouldRetry(attempt: number, error: Error): boolean {
    return attempt < this.config.maxAttempts && this.isRetryableError(error);
  }

  getDelay(attempt: number): number {
    const baseDelay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(baseDelay, this.config.maxDelay);

    // Agregar jitter para evitar thundering herd
    if (this.config.jitter) {
      const jitter = cappedDelay * 0.1 * Math.random();
      return cappedDelay + jitter;
    }

    return cappedDelay;
  }

  onRetry(attempt: number, error: Error, delay: number): void {
    console.warn(`⚠️  Intento ${attempt} falló, reintentando en ${Math.round(delay)}ms...`, {
      error: error.message,
      attempt,
      nextRetryIn: `${Math.round(delay)}ms`
    });
  }

  onSuccess(attempt: number): void {
    if (attempt > 1) {
      console.log(`✅ Operación exitosa después de ${attempt} intentos`);
    }
  }

  onFailure(attempts: number, lastError: Error): void {
    console.error(`❌ Operación falló después de ${attempts} intentos`, {
      attempts,
      finalError: lastError.message
    });
  }

  private isRetryableError(error: Error): boolean {
    // Errores de red comunes que son recuperables
    const retryablePatterns = [
      /timeout/i,
      /connection/i,
      /network/i,
      /temporary/i,
      /rate limit/i,
      /too many requests/i,
      /ECONNRESET/i,
      /ENOTFOUND/i,
      /ETIMEDOUT/i,
      /502/i,  // Bad Gateway
      /503/i,  // Service Unavailable
      /504/i,  // Gateway Timeout
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }
}

/**
 * Implementación de retry con delay fijo
 */
class FixedDelayRetryImpl implements IRetryStrategy {
  constructor(private config: RetryConfig) {}

  shouldRetry(attempt: number, error: Error): boolean {
    return attempt < this.config.maxAttempts && this.isRetryableError(error);
  }

  getDelay(attempt: number): number {
    return this.config.baseDelay;
  }

  onRetry(attempt: number, _error: Error, delay: number): void {
    console.warn(`⚠️  Intento ${attempt} falló, reintentando en ${delay}ms...`);
  }

  onSuccess(attempt: number): void {
    if (attempt > 1) {
      console.log(`✅ Operación exitosa después de ${attempt} intentos`);
    }
  }

  onFailure(attempts: number, _lastError: Error): void {
    console.error(`❌ Operación falló después de ${attempts} intentos`);
  }

  private isRetryableError(error: Error): boolean {
    return !error.message.includes('Authentication failed') &&
           !error.message.includes('Permission denied') &&
           !error.message.includes('Invalid configuration');
  }
}

/**
 * Función principal de retry con estrategia configurable
 */
export async function retryWithStrategy<T>(
  operation: () => Promise<T>,
  strategy: IRetryStrategy,
  context?: string
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= strategyConfig.maxAttempts; attempt++) {
    try {
      const result = await operation();
      strategy.onSuccess?.(attempt);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!strategy.shouldRetry(attempt, lastError)) {
        strategy.onFailure?.(attempt, lastError);
        throw lastError;
      }

      if (attempt < strategyConfig.maxAttempts) {
        const delay = strategy.getDelay(attempt);
        strategy.onRetry?.(attempt, lastError, delay);
        await sleep(delay);
      }
    }
  }

  strategy.onFailure?.(strategyConfig.maxAttempts, lastError);
  throw new RetryExhaustedError(
    `Operación fallida después de ${strategyConfig.maxAttempts} intentos${context ? ` (${context})` : ''}`,
    strategyConfig.maxAttempts,
    lastError
  );
}

/**
 * Función de conveniencia para retry con backoff exponencial
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context?: string
): Promise<T> {
  const defaultConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
  };

  const strategy = new ExponentialBackoffRetryImpl({
    ...defaultConfig,
    ...config,
  });

  return retryWithStrategy(operation, strategy, context);
}

/**
 * Función de conveniencia para retry con delay fijo
 */
export async function retryWithFixedDelay<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context?: string
): Promise<T> {
  const defaultConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 1,
    jitter: false,
  };

  const strategy = new FixedDelayRetryImpl({
    ...defaultConfig,
    ...config,
  });

  return retryWithStrategy(operation, strategy, context);
}

/**
 * Función para crear una estrategia de retry
 */
export function createRetryStrategy(config: RetryConfig): IRetryStrategy {
  switch (config.backoffMultiplier) {
    case 1:
      return new FixedDelayRetryImpl(config);
    default:
      return new ExponentialBackoffRetryImpl(config);
  }
}

/**
 * Wrapper para funciones asíncronas con retry
 */
export function withRetry<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  config: Partial<RetryConfig> = {}
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    return retryWithBackoff(() => fn(...args), config, fn.name);
  };
}

/**
 * Función de utilidad para dormir
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Función para crear un retry wrapper con timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage || `Operación timeout después de ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

/**
 * Función combinada de retry con timeout
 */
export async function retryWithTimeout<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  timeoutMs: number = 300000, // 5 minutos por defecto
  context?: string
): Promise<T> {
  return retryWithBackoff(
    () => withTimeout(operation(), timeoutMs),
    config,
    context
  );
}

/**
 * Interfaz para circuit breaker
 */
export interface ICircuitBreaker {
  execute<T>(operation: () => Promise<T>): Promise<T>;
  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  reset(): void;
}

/**
 * Implementación simple de Circuit Breaker
 */
export class CircuitBreaker implements ICircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold = 5,
    private recoveryTimeout = 60000 // 1 minuto
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  reset(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

// Exportaciones para facilitar el uso - con alias para evitar conflictos
export const ExponentialBackoffRetry = ExponentialBackoffRetryImpl;
export const FixedDelayRetry = FixedDelayRetryImpl;

// Variable global para estrategia
let strategyConfig: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 2000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

export function setRetryConfig(config: Partial<RetryConfig>): void {
  strategyConfig = { ...strategyConfig, ...config };
}

export function getRetryConfig(): RetryConfig {
  return { ...strategyConfig };
}