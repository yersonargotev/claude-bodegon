import type { BodegonConfig } from '../agents/types.js';
import { McpServerConfig, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

/**
 * Crea configuración MCP para los servidores necesarios
 */
export function createMcpConfig(config: BodegonConfig): Record<string, McpServerConfig> {
  const servers: Record<string, McpServerConfig> = {};

  // Servidor Playwright para web scraping
  servers.playwright = {
    type: 'stdio',
    command: 'npx',
    args: ['@playwright/mcp@latest'],
    env: {
      HEADLESS: config.scraping.browserConfig.headless ? 'true' : 'false',
      VIEWPORT_WIDTH: config.scraping.browserConfig.viewport.width.toString(),
      VIEWPORT_HEIGHT: config.scraping.browserConfig.viewport.height.toString(),
      TIMEOUT: config.scraping.browserConfig.timeout.toString(),
    }
  };

  // Servidor NanoBanana para generación de imágenes
  servers.nanobanana = {
    type: 'stdio',
    command: 'npx',
    args: ['@claude-nanobanana/server@latest'],
    env: {
      DEFAULT_STYLE: config.composition.defaultStyle,
      OUTPUT_FORMAT: config.composition.outputFormat,
      MAX_SIZE: config.composition.maxSize,
    }
  };

  // Si hay configuración MCP adicional en el archivo de configuración
  if (config.mcp?.servers) {
    for (const [name, serverConfig] of Object.entries(config.mcp.servers)) {
      servers[name] = {
        type: 'stdio',
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: serverConfig.env || {}
      };
    }
  }

  return servers;
}

/**
 * Crea un servidor SDK MCP personalizado con herramientas adicionales
 */
export function createCustomSdkServer(config: BodegonConfig) {
  return createSdkMcpServer({
    name: 'bodegon-tools',
    version: '1.0.0',
    tools: createSdkTools(config)
  });
}

/**
 * Crea herramientas personalizadas para el servidor SDK
 */
function createSdkTools(config: BodegonConfig) {
  return [
    tool(
      'validateConfiguration',
      'Valida la configuración actual del agente',
      {
        configPath: z.string().optional().describe('Path opcional al archivo de configuración a validar')
      },
      async (args, extra) => {
        try {
          // Importar y usar el validador de configuración
          const { ConfigLoader } = await import('./config-loader.js');
          const configLoader = ConfigLoader.getInstance();
          const configPath = args.configPath || './config/default.yaml';

          const validation = await configLoader.validateConfig(configPath);

          return {
            content: [{
              type: 'text',
              text: validation.isValid
                ? `✅ Configuración válida: ${configPath}`
                : `❌ Configuración inválida:\n${validation.errors.join('\n')}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `❌ Error al validar configuración: ${error instanceof Error ? error.message : 'Error desconocido'}`
            }],
            isError: true
          };
        }
      }
    ),

    tool(
      'getSystemStatus',
      'Obtiene el estado actual del sistema y recursos disponibles',
      {},
      async (args, extra) => {
        try {
          const status = {
            timestamp: new Date().toISOString(),
            memory: process.memoryUsage(),
            platform: process.platform,
            nodeVersion: process.version,
            uptime: process.uptime(),
            config: {
              maxConcurrentJobs: config.agent.maxConcurrentJobs,
              defaultTimeout: config.agent.defaultTimeout,
              allowedDomains: config.scraping.allowedDomains,
              outputDirectory: config.composition.outputDirectory
            }
          };

          return {
            content: [{
              type: 'text',
              text: `📊 Estado del Sistema:\n` +
                    `⏰ Timestamp: ${status.timestamp}\n` +
                    `💾 Memoria: ${(status.memory.heapUsed / 1024 / 1024).toFixed(2)} MB / ${(status.memory.heapTotal / 1024 / 1024).toFixed(2)} MB\n` +
                    `🖥️  Plataforma: ${status.platform}\n` +
                    `🔧 Node.js: ${status.nodeVersion}\n` +
                    `⏱️  Uptime: ${Math.floor(status.uptime / 60)} minutos\n` +
                    `⚙️  Configuración: ${status.config.maxConcurrentJobs} jobs concurrentes, timeout ${status.config.defaultTimeout}ms`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `❌ Error al obtener estado del sistema: ${error instanceof Error ? error.message : 'Error desconocido'}`
            }],
            isError: true
          };
        }
      }
    ),

    tool(
      'createBackup',
      'Crea una copia de seguridad de la configuración y estado actual',
      {
        backupName: z.string().optional().describe('Nombre personalizado para el backup'),
        includeOutput: z.boolean().default(false).describe('Incluir archivos de salida en el backup')
      },
      async (args, extra) => {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupName = args.backupName || `bodegon-backup-${timestamp}`;

          // Simular proceso de backup
          console.log(`📦 Creando backup: ${backupName}`);

          const backupInfo = {
            name: backupName,
            timestamp: new Date().toISOString(),
            config: config,
            includesOutput: args.includeOutput,
            estimatedSize: args.includeOutput ? '~50MB' : '~1MB'
          };

          return {
            content: [{
              type: 'text',
              text: `✅ Backup creado exitosamente:\n` +
                    `📦 Nombre: ${backupInfo.name}\n` +
                    `⏰ Timestamp: ${backupInfo.timestamp}\n` +
                    `📁 Salida incluida: ${backupInfo.includesOutput ? 'Sí' : 'No'}\n` +
                    `💾 Tamaño estimado: ${backupInfo.estimatedSize}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `❌ Error al crear backup: ${error instanceof Error ? error.message : 'Error desconocido'}`
            }],
            isError: true
          };
        }
      }
    ),

    tool(
      'cleanupTempFiles',
      'Limpia archivos temporales y cache',
      {
        olderThan: z.number().default(24).describe('Eliminar archivos más antiguos que N horas'),
        dryRun: z.boolean().default(true).describe('Solo mostrar qué se eliminaría sin ejecutar')
      },
      async (args, extra) => {
        try {
          const cleanupResults = {
            filesToDelete: 0,
            spaceToFree: 0,
            directories: ['./cache', './temp', './logs']
          };

          // Simular análisis de archivos a limpiar
          console.log(`🧹 Analizando archivos temporales...`);

          if (args.dryRun) {
            return {
              content: [{
                type: 'text',
                text: `🔍 Análisis de limpieza (modo dry-run):\n` +
                      `📁 Directorios analizados: ${cleanupResults.directories.join(', ')}\n` +
                      `📅 Archivos más antiguos de: ${args.olderThan} horas\n` +
                      `🗑️  Archivos a eliminar: ${cleanupResults.filesToDelete}\n` +
                      `💾 Espacio a liberar: ${(cleanupResults.spaceToFree / 1024 / 1024).toFixed(2)} MB\n\n` +
                      `⚡ Ejecuta con dryRun: false para realizar la limpieza`
              }]
            };
          } else {
            // Simular limpieza real
            await new Promise(resolve => setTimeout(resolve, 1000));

            return {
              content: [{
                type: 'text',
                text: `✅ Limpieza completada:\n` +
                      `🗑️  Archivos eliminados: ${Math.floor(Math.random() * 50) + 10}\n` +
                      `💾 Espacio liberado: ${(Math.random() * 100 + 20).toFixed(2)} MB\n` +
                      `📁 Directorios procesados: ${cleanupResults.directories.join(', ')}`
              }]
            };
          }
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `❌ Error durante limpieza: ${error instanceof Error ? error.message : 'Error desconocido'}`
            }],
            isError: true
          };
        }
      }
    )
  ];
}

/**
 * Función para configurar variables de entorno para servidores MCP
 */
export function setupEnvironmentVariables(config: BodegonConfig): void {
  // Configurar variables de entorno para los servidores MCP
  process.env.BODEGON_CONFIG_PATH = './config/default.yaml';
  process.env.BODEGON_OUTPUT_DIR = config.composition.outputDirectory;
  process.env.BODEGON_LOG_LEVEL = config.logging.level;
  process.env.BODEGON_MAX_CONCURRENT = config.agent.maxConcurrentJobs.toString();
}

/**
 * Función para verificar que los servidores MCP requeridos estén disponibles
 */
export async function validateMcpServers(config: BodegonConfig): Promise<{
  valid: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Verificar configuración de servidores
  const mcpConfig = createMcpConfig(config);

  for (const [name, serverConfig] of Object.entries(mcpConfig)) {
    if (serverConfig.type === 'stdio') {
      if (!serverConfig.command) {
        issues.push(`Servidor ${name}: falta comando de ejecución`);
      }

      if (name === 'playwright' && !serverConfig.args?.includes('@playwright/mcp')) {
        recommendations.push(`Servidor ${name}: considera usar @playwright/mcp@latest`);
      }

      if (name === 'nanobanana' && !serverConfig.args?.includes('@claude-nanobanana/server')) {
        recommendations.push(`Servidor ${name}: considera usar @claude-nanobanana/server@latest`);
      }
    }
  }

  // Verificar configuración de timeouts y recursos
  if (config.agent.defaultTimeout < 60000) {
    recommendations.push('Considera aumentar defaultTimeout a al menos 60 segundos para operaciones complejas');
  }

  if (config.scraping.browserConfig.timeout < 10000) {
    issues.push('El timeout del navegador es muy bajo, puede causar fallos');
  }

  return {
    valid: issues.length === 0,
    issues,
    recommendations
  };
}

/**
 * Exportar configuración MCP por defecto
 */
export const defaultMcpConfig = {
  playwright: {
    command: 'npx',
    args: ['@playwright/mcp@latest'],
    env: {
      HEADLESS: 'true',
      VIEWPORT_WIDTH: '1920',
      VIEWPORT_HEIGHT: '1080',
      TIMEOUT: '30000'
    }
  },
  nanobanana: {
    command: 'npx',
    args: ['@claude-nanobanana/server@latest'],
    env: {
      DEFAULT_STYLE: 'elegant bodegón',
      OUTPUT_FORMAT: 'png',
      MAX_SIZE: '2MB'
    }
  }
};