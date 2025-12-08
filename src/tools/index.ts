import type { BodegonConfig } from '../agents/types.js';
import { createAllScrapingTools } from './image-scraper.js';
import { createAllComposerTools } from './bodegon-composer.js';

/**
 * Crea todas las herramientas MCP personalizadas para el agente Bodegón
 */
export function createAllTools(config: BodegonConfig) {
  return [
    ...createAllScrapingTools(config),
    ...createAllComposerTools(config)
  ];
}

/**
 * Exportar herramientas individuales para uso modular
 */
export {
  createImageScraperTool,
  createUrlValidationTool,
  createScrapingStatsTool,
  createAllScrapingTools
} from './image-scraper.js';

export {
  createBodegonComposerTool,
  createImageOptimizerTool,
  createPromptSuggestionTool,
  createCompositionValidatorTool,
  createAllComposerTools
} from './bodegon-composer.js';

/**
 * Exportar tipos útiles
 */
// export type { ToolDefinition } from '@anthropic-ai/claude-agent-sdk';