import { z } from 'zod';

/**
 * Esquema de configuración principal del agente Bodegón
 */
export const BodegonConfigSchema = z.object({
  agent: z.object({
    name: z.string().default('bodegon-creator'),
    model: z.enum(['sonnet', 'opus', 'haiku']).default('sonnet'),
    maxConcurrentJobs: z.number().int().positive().default(3),
    defaultTimeout: z.number().int().positive().default(300000), // 5 minutos
  }),
  mcp: z.object({
    servers: z.record(z.object({
      command: z.string(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string()).optional(),
    })).optional(),
  }).optional(),
  scraping: z.object({
    maxImages: z.number().int().positive().max(10).default(3),
    imageQuality: z.enum(['high', 'medium', 'low']).default('high'),
    screenshotFormat: z.enum(['png', 'jpeg']).default('png'),
    allowedDomains: z.array(z.string()).default([
      'exito.com',
      'falabella.com',
      'linio.com',
      'mercado libre.com',
    ]),
    browserConfig: z.object({
      headless: z.boolean().default(true),
      viewport: z.object({
        width: z.number().int().positive().default(1920),
        height: z.number().int().positive().default(1080),
      }),
      timeout: z.number().int().positive().default(30000), // 30 segundos
    }),
  }),
  composition: z.object({
    defaultStyle: z.string().default('elegant bodegón'),
    maxImagesPerComposition: z.number().int().positive().max(10).default(5),
    outputFormat: z.enum(['png', 'jpeg']).default('png'),
    outputDirectory: z.string().default('./bodegon-output'),
    maxSize: z.string().default('2MB'),
  }),
  retry: z.object({
    maxAttempts: z.number().int().positive().max(10).default(3),
    baseDelay: z.number().int().positive().default(2000), // 2 segundos
    maxDelay: z.number().int().positive().default(30000), // 30 segundos
    backoffMultiplier: z.number().positive().default(2),
  }),
  progress: z.object({
    interactive: z.boolean().default(true),
    updateInterval: z.number().int().positive().default(1000), // 1 segundo
    showEta: z.boolean().default(true),
    detailedOutput: z.boolean().default(false),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    file: z.string().default('./logs/bodegon-agent.log'),
    maxFileSize: z.string().default('10MB'),
    maxFiles: z.number().int().positive().default(5),
    console: z.boolean().default(true),
  }),
});

/**
 * Tipo de configuración del agente inferido del esquema
 */
export type BodegonConfig = z.infer<typeof BodegonConfigSchema>;

/**
 * Esquema para solicitud de procesamiento
 */
export const ProcessingRequestSchema = z.object({
  url: z.string().url('La URL debe ser válida'),
  prompt: z.string().min(10, 'El prompt debe tener al menos 10 caracteres'),
  outputName: z.string().optional(),
  customSettings: z.object({
    maxImages: z.number().int().positive().max(10).optional(),
    imageQuality: z.enum(['high', 'medium', 'low']).optional(),
    outputDirectory: z.string().optional(),
  }).optional(),
});

/**
 * Tipo de solicitud de procesamiento
 */
export type ProcessingRequest = z.infer<typeof ProcessingRequestSchema>;

/**
 * Esquema para lote de procesamiento
 */
export const BatchProcessingRequestSchema = z.object({
  requests: z.array(ProcessingRequestSchema).min(1, 'Debe haber al menos una solicitud'),
  parallelProcessing: z.boolean().default(false),
  maxConcurrent: z.number().int().positive().max(10).default(3),
  outputDirectory: z.string().optional(),
});

/**
 * Tipo de lote de procesamiento
 */
export type BatchProcessingRequest = z.infer<typeof BatchProcessingRequestSchema>;

/**
 * Estados del workflow
 */
export type WorkflowStep = 'setup' | 'scraping' | 'composition' | 'validation' | 'complete' | 'error';

/**
 * Esquema de estado del workflow
 */
export const WorkflowStateSchema = z.object({
  step: z.enum(['setup', 'scraping', 'composition', 'validation', 'complete', 'error']),
  totalRequests: z.number().int().positive(),
  completedRequests: z.number().int().nonnegative(),
  currentRequestIndex: z.number().int().nonnegative(),
  imagesCollected: z.number().int().nonnegative(),
  compositionsCreated: z.number().int().nonnegative(),
  errors: z.array(z.object({
    step: z.string(),
    message: z.string(),
    timestamp: z.date(),
    requestId: z.string().optional(),
  })),
  startTime: z.date(),
  currentRequest: z.string().optional(),
  eta: z.string().optional(),
});

/**
 * Tipo de estado del workflow
 */
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

/**
 * Esquema de resultado de imagen capturada
 */
export const CapturedImageSchema = z.object({
  url: z.string(),
  filename: z.string(),
  path: z.string(),
  size: z.number().int().positive(),
  format: z.enum(['png', 'jpeg']),
  timestamp: z.date(),
  sourceUrl: z.string(),
  productTitle: z.string().optional(),
});

/**
 * Tipo de imagen capturada
 */
export type CapturedImage = z.infer<typeof CapturedImageSchema>;

/**
 * Esquema de resultado de composición
 */
export const CompositionResultSchema = z.object({
  filename: z.string(),
  path: z.string(),
  size: z.number().int().positive(),
  format: z.enum(['png', 'jpeg']),
  sourceImages: z.array(z.string()),
  prompt: z.string(),
  timestamp: z.date(),
  processingTime: z.number().int().positive(), // milisegundos
});

/**
 * Tipo de resultado de composición
 */
export type CompositionResult = z.infer<typeof CompositionResultSchema>;

/**
 * Esquema de resultado completo del procesamiento
 */
export const ProcessingResultSchema = z.object({
  requestId: z.string(),
  url: z.string(),
  status: z.enum(['success', 'partial', 'error']),
  capturedImages: z.array(CapturedImageSchema),
  compositions: z.array(CompositionResultSchema),
  errors: z.array(z.string()),
  startTime: z.date(),
  endTime: z.date(),
  processingTime: z.number().int().positive(),
});

/**
 * Tipo de resultado completo del procesamiento
 */
export type ProcessingResult = z.infer<typeof ProcessingResultSchema>;

/**
 * Esquema de configuración de retry
 */
export const RetryConfigSchema = z.object({
  maxAttempts: z.number().int().positive().max(10).default(3),
  baseDelay: z.number().int().positive().default(2000),
  maxDelay: z.number().int().positive().default(30000),
  backoffMultiplier: z.number().positive().default(2),
  jitter: z.boolean().default(true),
});

/**
 * Tipo de configuración de retry
 */
export type RetryConfig = z.infer<typeof RetryConfigSchema>;

/**
 * Opciones para el agente
 */
export interface AgentOptions {
  config?: Partial<BodegonConfig>;
  onProgress?: (state: WorkflowState) => void;
  onError?: (error: Error, context: unknown) => void;
  onResult?: (result: ProcessingResult) => void;
}

/**
 * Interfaz del agente Bodegón Creator
 */
export interface IBodegonAgent {
  processSingle(request: ProcessingRequest): Promise<AsyncGenerator<ProcessingResult, void>>;
  processBatch(batch: BatchProcessingRequest): Promise<AsyncGenerator<ProcessingResult[], void>>;
  getState(): WorkflowState;
  getConfig(): BodegonConfig;
  updateConfig(config: Partial<BodegonConfig>): void;
  cancel(): void;
}

/**
 * Tipos de eventos del agente
 */
export type AgentEventType = 'progress' | 'error' | 'result' | 'complete' | 'cancelled';

export interface AgentEvent {
  type: AgentEventType;
  data: unknown;
  timestamp: Date;
}

/**
 * Interfaz para tracking de progreso
 */
export interface IProgressTracker {
  updateProgress(state: Partial<WorkflowState>): void;
  addError(error: string, step?: string, requestId?: string): void;
  getProgress(): WorkflowState;
  reset(): void;
}

/**
 * Interfaz para validación de URLs
 */
export interface IUrlValidator {
  isValidUrl(url: string): boolean;
  isAllowedDomain(url: string, allowedDomains: string[]): boolean;
  sanitizeUrl(url: string): string;
}

/**
 * Interfaz para manejo de archivos
 */
export interface IFileManager {
  ensureDirectory(path: string): Promise<void>;
  generateFilename(base: string, extension: string): string;
  saveFile(path: string, data: Buffer | string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;
}

/**
 * Exportar tipos útiles
 */
export type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';