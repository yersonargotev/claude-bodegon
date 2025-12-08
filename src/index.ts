/**
 * Bodegón Creator Agent - Agente personalizado para crear composiciones artísticas
 * desde imágenes de productos de e-commerce.
 */

import type {
  BodegonConfig,
  WorkflowState,
  IBodegonAgent
} from './agents/types.js';
import { createBodegonAgent } from './agents/bodegon-creator.js';

// Exportar tipos principales
export type {
  BodegonConfig,
  ProcessingRequest,
  BatchProcessingRequest,
  WorkflowState,
  ProcessingResult,
  CapturedImage,
  CompositionResult,
  RetryConfig,
  IBodegonAgent,
  AgentOptions
} from './agents/types.js';

// Exportar agente principal
export { createBodegonAgent as default, createBodegonAgent } from './agents/bodegon-creator.js';

// Exportar herramientas
export {
  createAllTools,
  createImageScraperTool,
  createUrlValidationTool,
  createScrapingStatsTool,
  createBodegonComposerTool,
  createImageOptimizerTool,
  createPromptSuggestionTool,
  createCompositionValidatorTool
} from './tools/index.js';

// Exportar configuración
export {
  loadConfig,
  loadEnvironmentConfig,
  validateConfigFile,
  saveConfigToFile,
  ConfigLoader
} from './config/config-loader.js';

export {
  createMcpConfig,
  createCustomSdkServer,
  setupEnvironmentVariables,
  validateMcpServers,
  defaultMcpConfig
} from './config/mcp-servers.js';

// Exportar utilidades
export {
  retryWithBackoff,
  retryWithFixedDelay,
  retryWithTimeout,
  createRetryStrategy,
  withRetry,
  RetryExhaustedError,
  CircuitBreaker
} from './utils/retry.js';

export {
  ProgressManager,
  ProgressTracker,
  ConsoleProgressFormatter,
  DetailedProgressFormatter,
  createProgressManager,
  MultiWorkflowProgressManager
} from './utils/progress.js';

export {
  UrlValidator,
  ProcessingRequestValidator,
  ConfigValidator,
  ValidationHelpers,
  urlValidator,
  requestValidator,
  configValidator
} from './utils/validation.js';

// Exportar validadores de esquemas
export {
  BodegonConfigSchema,
  ProcessingRequestSchema,
  BatchProcessingRequestSchema,
  WorkflowStateSchema,
  CapturedImageSchema,
  CompositionResultSchema,
  ProcessingResultSchema,
  RetryConfigSchema
} from './agents/types.js';

// Exportar utilidades de CLI (para uso interno)
export { createCliApp } from './cli/index.js';

/**
 * Versión del paquete
 */
export const VERSION = '1.0.0';

/**
 * Información del paquete
 */
export const PACKAGE_INFO = {
  name: '@bodegón/creator-agent',
  version: VERSION,
  description: 'Agente personalizado para crear composiciones artísticas bodegón desde imágenes de productos',
  author: 'Bodegón Creator Team',
  license: 'MIT'
};

/**
 * Función de conveniencia para crear y configurar un agente rápidamente
 */
export async function createQuickAgent(options: {
  environment?: 'development' | 'production';
  customConfig?: Partial<BodegonConfig>;
  onProgress?: (state: WorkflowState) => void;
  onError?: (error: Error, context: unknown) => void;
} = {}) {
  const { loadEnvironmentConfig } = await import('./config/config-loader.js');
  const config = options.customConfig || await loadEnvironmentConfig(options.environment || 'development');

  return createBodegonAgent({
    config,
    onProgress: options.onProgress,
    onError: options.onError
  });
}

/**
 * Función de ejemplo básico para demostrar el uso del agente
 */
export async function quickExample() {
  console.log('🎨 Creando agente Bodegón Creator...');

  const agent = await createQuickAgent({
    environment: 'development'
  });

  const request = {
    url: 'https://www.exito.com/tecnologia/consolas-y-videojuegos',
    prompt: 'Crea un bodegón elegante que muestre estos productos tecnológicos como piezas de arte contemporáneo con iluminación dramática'
  };

  console.log('🚀 Iniciando procesamiento...');

  try {
    for await (const result of await agent.processSingle(request)) {
      if (result.status === 'success') {
        console.log('✅ Completado:', {
          requestId: result.requestId,
          images: result.capturedImages.length,
          compositions: result.compositions.length,
          processingTime: result.processingTime
        });
      } else {
        console.log('❌ Error:', result.errors);
      }
    }
  } catch (error) {
    console.error('❌ Error en procesamiento:', error);
  }
}

// Exportar una función principal para ejecutar desde CLI
export async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--example') || args.includes('-e')) {
    await quickExample();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🎨 Bodegón Creator Agent v${VERSION}

Uso básico:
  import { createBodegonAgent } from '@bodegón/creator-agent';

  const agent = await createBodegonAgent();
  const result = await agent.processSingle({
    url: 'https://ejemplo.com/producto',
    prompt: 'Crea un bodegón elegante'
  });

Para ejecutar el ejemplo:
  node --loader tsx/esm src/index.ts --example

Para más información, visita: https://github.com/bodegón/creator-agent
    `);
  } else {
    console.log('Usa --help para ver las opciones disponibles');
  }
}