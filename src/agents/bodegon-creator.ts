import { query, AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import type {
  BodegonConfig,
  ProcessingRequest,
  BatchProcessingRequest,
  ProcessingResult,
  WorkflowState,
  IBodegonAgent,
  AgentOptions
} from './types.js';
import { createAllTools } from '../tools/index.js';
import { createMcpConfig, setupEnvironmentVariables, validateMcpServers } from '../config/mcp-servers.js';
import { ProgressManager } from '../utils/progress.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Implementación funcional del agente Bodegón Creator
 */
// Global state for the agent instance
let workflowState: WorkflowState;
let progressManager: ProgressManager | null = null;
let isCancelled = false;

export function createBodegonAgent(options: AgentOptions = {}): IBodegonAgent {
  // Cargar configuración (default a desarrollo)
  const configPromise = (async () => {
    const { loadEnvironmentConfig } = await import('../config/config-loader.js');
    return options.config || await loadEnvironmentConfig('development');
  })();

  // Estado del agente - accessible to all functions
  workflowState = {
    step: 'setup',
    totalRequests: 0,
    completedRequests: 0,
    currentRequestIndex: 0,
    imagesCollected: 0,
    compositionsCreated: 0,
    errors: [],
    startTime: new Date(),
    eta: undefined,
    currentRequest: undefined
  } as WorkflowState;

  // Métodos del agente
  const agent: IBodegonAgent = {
    async processSingle(request: ProcessingRequest): Promise<AsyncGenerator<ProcessingResult, void>> {
      const batchRequest: BatchProcessingRequest = {
        requests: [request],
        parallelProcessing: false,
        maxConcurrent: 1
      };

      const batchGenerator = await agent.processBatch(batchRequest);

      return (async function*() {
        for await (const batch of batchGenerator) {
          // Batch returns arrays, but single processing should yield individual results
          for (const result of batch) {
            yield result;
          }
        }
      })();
    },

    async processBatch(batch: BatchProcessingRequest): Promise<AsyncGenerator<ProcessingResult[], void>> {
      const config = await configPromise;

      // Configurar ambiente
      setupEnvironmentVariables(config);

      // Validar servidores MCP
      const mcpValidation = await validateMcpServers(config);
      if (!mcpValidation.valid) {
        console.warn('⚠️  Problemas con configuración MCP:', mcpValidation.issues);
      }
      if (mcpValidation.recommendations.length > 0) {
        console.info('💡 Recomendaciones MCP:', mcpValidation.recommendations);
      }

      // Configurar progress manager
      if (options.onProgress && config.progress.interactive) {
        progressManager = new ProgressManager();
        progressManager.start({
          step: 'setup',
          totalRequests: batch.requests.length,
          completedRequests: 0,
          currentRequestIndex: 0,
          imagesCollected: 0,
          compositionsCreated: 0,
          errors: [],
          startTime: new Date(),
          eta: undefined,
          currentRequest: undefined
        } as WorkflowState);
      }

      // Inicializar estado
      workflowState = {
        step: 'setup',
        totalRequests: batch.requests.length,
        completedRequests: 0,
        currentRequestIndex: 0,
        imagesCollected: 0,
        compositionsCreated: 0,
        errors: [],
        startTime: new Date(),
        eta: undefined,
        currentRequest: undefined
      } as WorkflowState;

      return executeBatchProcessing(batch, config);
    },

    getState(): WorkflowState {
      return { ...workflowState };
    },

    getConfig(): BodegonConfig {
      // For now, return default config - in real implementation this would be resolved
      return {
        agent: {
          name: 'bodegon-creator',
          model: 'sonnet',
          maxConcurrentJobs: 3,
          defaultTimeout: 300000
        },
        mcp: {
          servers: {}
        },
        scraping: {
          maxImages: 3,
          imageQuality: 'high',
          screenshotFormat: 'png',
          allowedDomains: ['exito.com', 'falabella.com', 'linio.com', 'mercado libre.com'],
          browserConfig: {
            headless: true,
            viewport: { width: 1920, height: 1080 },
            timeout: 30000
          }
        },
        composition: {
          defaultStyle: 'elegant bodegón',
          maxImagesPerComposition: 5,
          outputFormat: 'png',
          outputDirectory: './bodegon-output',
          maxSize: '2MB'
        },
        retry: {
          maxAttempts: 3,
          baseDelay: 2000,
          maxDelay: 30000,
          backoffMultiplier: 2
        },
        progress: {
          interactive: true,
          updateInterval: 1000,
          showEta: true,
          detailedOutput: false
        },
        logging: {
          level: 'info',
          file: './logs/bodegon-agent.log',
          maxFileSize: '10MB',
          maxFiles: 5,
          console: true
        }
      };
    },

    updateConfig(newConfig: Partial<BodegonConfig>): void {
      // En una implementación real, fusionaríamos la configuración
      console.log('🔧 Configuración actualizada:', Object.keys(newConfig));
    },

    cancel(): void {
      isCancelled = true;
      if (progressManager) {
        progressManager.stop();
      }
    }
  };

  return agent;
}

/**
 * Ejecuta el procesamiento por lotes
 */
async function* executeBatchProcessing(
  batch: BatchProcessingRequest,
  config: BodegonConfig
): AsyncGenerator<ProcessingResult[], void> {
  const agentDefinition = createAgentDefinition(config);
  const mcpServers = createMcpConfig(config);

  try {
    // Procesar solicitudes
    if (batch.parallelProcessing) {
      yield* processParallel(batch.requests, config, agentDefinition, mcpServers);
    } else {
      yield* processSequential(batch.requests, config, agentDefinition, mcpServers);
    }
  } catch (error) {
    console.error('❌ Error en procesamiento por lotes:', error);
  } finally {
    if (progressManager) {
      progressManager.stop();
    }
  }
}

/**
 * Procesamiento secuencial de solicitudes
 */
async function* processSequential(
  requests: ProcessingRequest[],
  config: BodegonConfig,
  agentDefinition: AgentDefinition,
  mcpServers: Record<string, any>
): AsyncGenerator<ProcessingResult[], void> {
  for (let i = 0; i < requests.length; i++) {
    if (isCancelled) {
      console.log('🛑 Procesamiento cancelado');
      break;
    }

    const request = requests[i];
    updateWorkflowState({
      step: 'scraping',
      currentRequestIndex: i,
      currentRequest: request.url
    } as Partial<WorkflowState>);

    try {
      const result = await processRequest(request, config, agentDefinition, mcpServers);
      yield [result];

      // Actualizar estadísticas
      updateWorkflowState({
        completedRequests: workflowState.completedRequests + 1,
        imagesCollected: workflowState.imagesCollected + result.capturedImages.length,
        compositionsCreated: workflowState.compositionsCreated + result.compositions.length
      } as Partial<WorkflowState>);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const errorResult: ProcessingResult = {
        requestId: uuidv4(),
        url: request.url,
        status: 'error',
        capturedImages: [],
        compositions: [],
        errors: [errorMessage],
        startTime: new Date(),
        endTime: new Date(),
        processingTime: 0
      };

      updateWorkflowState({
        completedRequests: workflowState.completedRequests + 1,
        errors: [
          ...workflowState.errors,
          {
            step: 'scraping',
            message: errorMessage,
            timestamp: new Date(),
            requestId: errorResult.requestId
          }
        ]
      } as Partial<WorkflowState>);

      yield [errorResult];
    }
  }

  updateWorkflowState({ step: 'complete' } as Partial<WorkflowState>);
}

/**
 * Procesamiento paralelo de solicitudes
 */
async function* processParallel(
  requests: ProcessingRequest[],
  config: BodegonConfig,
  agentDefinition: AgentDefinition,
  mcpServers: Record<string, any>
): AsyncGenerator<ProcessingResult[], void> {
  const maxConcurrent = Math.min(requests.length, 3); // Limitar para no sobrecargar
  const results: ProcessingResult[] = [];
  const chunks: ProcessingRequest[][] = [];

  // Dividir en chunks
  for (let i = 0; i < requests.length; i += maxConcurrent) {
    chunks.push(requests.slice(i, i + maxConcurrent));
  }

  for (const chunk of chunks) {
    if (isCancelled) break;

    const chunkPromises = chunk.map(request =>
      processRequest(request, config, agentDefinition, mcpServers)
        .catch(error => ({
          requestId: uuidv4(),
          url: request.url,
          status: 'error' as const,
          capturedImages: [],
          compositions: [],
          errors: [error instanceof Error ? error.message : 'Error desconocido'],
          startTime: new Date(),
          endTime: new Date(),
          processingTime: 0
        }))
    );

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);

    // Actualizar estadísticas
    const totalImages = chunkResults.reduce((sum, r) => sum + r.capturedImages.length, 0);
    const totalCompositions = chunkResults.reduce((sum, r) => sum + r.compositions.length, 0);

    updateWorkflowState({
      completedRequests: workflowState.completedRequests + chunkResults.length,
      imagesCollected: workflowState.imagesCollected + totalImages,
      compositionsCreated: workflowState.compositionsCreated + totalCompositions
    } as Partial<WorkflowState>);

    yield chunkResults;
  }

  updateWorkflowState({ step: 'complete' } as Partial<WorkflowState>);
}

/**
 * Procesa una solicitud individual usando Claude Agent SDK
 */
async function processRequest(
  request: ProcessingRequest,
  config: BodegonConfig,
  agentDefinition: AgentDefinition,
  mcpServers: Record<string, any>
): Promise<ProcessingResult> {
  const startTime = Date.now();
  const requestId = uuidv4();

  updateWorkflowState({
    step: 'scraping',
    currentRequest: request.url
  } as Partial<WorkflowState>);

  try {
    const prompt = buildUserPrompt(request);
    const queryGenerator = query({
      prompt,
      options: {
        agents: {
          'bodegon-creator': agentDefinition
        },
        mcpServers,
        allowedTools: buildAllowedTools(),
        maxTurns: 20,
        systemPrompt: buildSystemPrompt(config)
      }
    });

    // Procesar mensajes
    let capturedImages: any[] = [];
    let compositions: any[] = [];
    let hasErrors = false;

    for await (const message of queryGenerator) {
      if (isCancelled) {
        throw new Error('Procesamiento cancelado por el usuario');
      }

      if (message.type === 'assistant') {
        // Analizar respuesta del asistente para extraer resultados
        const response = message.message.content[0]?.text || '';

        // En una implementación real, parsearíamos la respuesta para extraer
        // información sobre imágenes capturadas y composiciones creadas
        if (response.includes('imagen capturada') || response.includes('composition creada')) {
          // Simular resultados
          capturedImages = simulateCapturedImages(request.url);
          compositions = simulateCompositions(capturedImages, request.prompt);
        }
      }
    }

    const endTime = Date.now();

    updateWorkflowState({
      step: 'complete'
    });

    return {
      requestId,
      url: request.url,
      status: hasErrors ? 'partial' : 'success',
      capturedImages,
      compositions,
      errors: [],
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      processingTime: endTime - startTime
    };
  } catch (error) {
    const endTime = Date.now();
    throw error;
  }
}

/**
 * Crea la definición del agente
 */
function createAgentDefinition(config: BodegonConfig): AgentDefinition {
  return {
    description: "Agente especializado en crear composiciones artísticas bodegón desde imágenes de productos de e-commerce",
    tools: [
      "TodoWrite",
      "scrapeProductImages",
      "validateScrapingUrl",
      "createBodegonComposition",
      "optimizeImages",
      "suggestArtisticPrompts",
      "validateComposition",
      "getScrapingStats"
    ],
    prompt: buildSystemPrompt(config),
    model: config.agent.model
  };
}

/**
 * Construye el prompt del sistema
 */
function buildSystemPrompt(config: BodegonConfig): string {
  return `Eres el Bodegón Creator Agent, un experto en transformar imágenes de productos de e-commerce en composiciones artísticas bodegón contemporáneas.

## Tu Misión
Crear composiciones artísticas de alta calidad siguiendo un workflow estructurado:
1. **Validación**: Verificar que las URLs y parámetros sean válidos
2. **Scraping**: Capturar imágenes de productos de forma sistemática
3. **Optimización**: Preparar las imágenes para la composición
4. **Composición**: Crear el bodegón artístico usando las imágenes
5. **Validación**: Asegurar la calidad del resultado final

## Herramientas Disponibles
- scrapeProductImages: Para capturar imágenes de URLs
- validateScrapingUrl: Para validar URLs antes del scraping
- createBodegonComposition: Para crear la composición artística
- optimizeImages: Para optimizar imágenes antes de la composición
- suggestArtisticPrompts: Para obtener ideas de prompts artísticos
- validateComposition: Para validar la calidad del resultado
- TodoWrite: Para跟踪 el progreso

## Configuración Actual
- Dominios permitidos: ${config.scraping.allowedDomains.join(', ')}
- Máximo de imágenes: ${config.scraping.maxImages}
- Calidad por defecto: ${config.scraping.imageQuality}
- Directorio de salida: ${config.composition.outputDirectory}
- Estilo por defecto: ${config.composition.defaultStyle}

## Directrices
- Siempre valida las URLs antes del scraping
 Usa TodoWrite para registrar progreso en cada paso
- Proporciona retroalimentación clara sobre cada operación
- Maneja errores gracefully con información detallada
- Optimiza las imágenes antes de la composición cuando sea posible
- Valida los resultados finales antes de completar

## Estilos Artísticos
Sabes crear diferentes estilos de bodegones:
- **Elegante**: Clásico, iluminación suave, composición equilibrada
- **Moderno**: Líneas limpias, minimalista, espacios negativos
- **Dramático**: Alto contraste, iluminación teatral
- **Vintage**: Tostado, texturas, clásico
- **Minimalista**: Simple, limpio, enfocado

Siempre prioriza la calidad artística y la experiencia del usuario.`;
}

/**
 * Construye el prompt de usuario para una solicitud
 */
function buildUserPrompt(request: ProcessingRequest): string {
  return `Por favor, crea una composición bodegón artística desde el siguiente producto:

**URL del producto**: ${request.url}
**Prompt artístico**: ${request.prompt}

Ejecuta el workflow completo:
1. Valida la URL de scraping
2. Captura las imágenes del producto
3. Optimiza las imágenes si es necesario
4. Crea la composición bodegón siguiendo las indicaciones artísticas
5. Valida el resultado final

Usa TodoWrite para registrar tu progreso y proporciona actualizaciones detalladas en cada paso.${request.customSettings ? `\n\n**Configuración personalizada**: ${JSON.stringify(request.customSettings, null, 2)}` : ''}`;
}

/**
 * Construye la lista de herramientas permitidas
 */
function buildAllowedTools(): string[] {
  return [
    "TodoWrite",
    "scrapeProductImages",
    "validateScrapingUrl",
    "createBodegonComposition",
    "optimizeImages",
    "suggestArtisticPrompts",
    "validateComposition",
    "getScrapingStats",
    // Herramientas MCP estándar
    "mcp__playwright__browser_navigate",
    "mcp__playwright__browser_click",
    "mcp__playwright__browser_take_screenshot",
    "mcp__plugin_claude-nanobanana_nanobanana__remix_image"
  ];
}

/**
 * Actualiza el estado del workflow
 */
function updateWorkflowState(updates: Partial<WorkflowState>): void {
  workflowState = { ...workflowState, ...updates };

  if (progressManager) {
    progressManager.updateProgress(workflowState);
  }

  // Notificar callback si existe
  // options.onProgress?.(workflowState);
}

/**
 * Simula imágenes capturadas (implementación mock)
 */
function simulateCapturedImages(url: string): any[] {
  const count = Math.floor(Math.random() * 3) + 1; // 1-3 imágenes
  const images = [];

  for (let i = 1; i <= count; i++) {
    images.push({
      url: `${url}/image-${i}`,
      filename: `product-${Date.now()}-${i}.png`,
      path: `./output/product-${Date.now()}-${i}.png`,
      size: Math.floor(Math.random() * 2_000_000) + 500_000,
      format: 'png',
      timestamp: new Date(),
      sourceUrl: url
    });
  }

  return images;
}

/**
 * Simula composiciones creadas (implementación mock)
 */
function simulateCompositions(images: any[], prompt: string): any[] {
  if (images.length === 0) return [];

  return [{
    filename: `bodegon-${Date.now()}.png`,
    path: `./output/bodegon-${Date.now()}.png`,
    size: Math.floor(Math.random() * 3_000_000) + 1_000_000,
    format: 'png',
    sourceImages: images.map(img => img.filename),
    prompt,
    timestamp: new Date(),
    processingTime: Math.floor(Math.random() * 5000) + 2000 // 2-7 segundos
  }];
}

// Exportar el factory function por defecto
export default createBodegonAgent;