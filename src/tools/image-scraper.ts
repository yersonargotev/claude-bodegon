import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { retryWithBackoff } from "../utils/retry.js";
import { urlValidator } from "../utils/validation.js";
import type { BodegonConfig, CapturedImage } from "../agents/types.js";

/**
 * Herramienta MCP para scraping de imágenes de productos
 */
export function createImageScraperTool(config: BodegonConfig) {
  return tool(
    "scrapeProductImages",
    "Extrae imágenes de productos de URLs de e-commerce con reintentos automáticos y validación",
    {
      url: z.string().url("La URL debe ser válida"),
      maxImages: z.number().int().min(1).max(10).default(3).describe("Número máximo de imágenes a capturar"),
      imageQuality: z.enum(['high', 'medium', 'low']).default('high').describe("Calidad de las imágenes"),
      outputDirectory: z.string().optional().describe("Directorio de salida personalizado"),
    },
    async (args, _extra) => {
      try {
        // Ensure required parameters are present
        if (!args.url) {
          return {
            content: [{
              type: "text",
              text: "Error: url parameter is required"
            }],
            isError: true
          };
        }

        // Validar URL
        if (!urlValidator.isValidUrl(args.url)) {
          throw new Error(`URL inválida: ${args.url}`);
        }

        if (!urlValidator.isAllowedDomain(args.url, config.scraping.allowedDomains)) {
          throw new Error(`Dominio no permitido. Dominios permitidos: ${config.scraping.allowedDomains.join(', ')}`);
        }

        const result = await retryWithBackoff(
          () => scrapeImages({
            url: args.url,
            maxImages: args.maxImages || 3,
            imageQuality: args.imageQuality || 'high',
            outputDirectory: args.outputDirectory
          }, config),
          config.retry,
          `scraping-${args.url}`
        );

        return {
          content: [{
            type: "text",
            text: `✅ Se capturaron ${result.length} imágenes de ${args.url}:\n${result.map(img => `  📸 ${img.filename}`).join('\n')}`
          }]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        return {
          content: [{
            type: "text",
            text: `❌ Error al capturar imágenes de ${args.url}: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );
}

/**
 * Función principal de scraping con implementación mock para desarrollo
 */
async function scrapeImages(
  args: { url: string; maxImages: number; imageQuality?: string; outputDirectory?: string },
  config: BodegonConfig
): Promise<CapturedImage[]> {
  const outputDir = args.outputDirectory || config.composition.outputDirectory;

  // Asegurar que el directorio de salida exista
  await ensureDirectory(outputDir);

  // Simular el proceso de scraping
  console.log(`🌐 Iniciando scraping de: ${args.url}`);

  // En una implementación real, aquí usaríamos Playwright MCP
  // Por ahora, simulamos el proceso con datos de ejemplo
  const capturedImages: CapturedImage[] = [];

  const imageCount = Math.min(args.maxImages, config.scraping.maxImages);

  for (let i = 1; i <= imageCount; i++) {
    const timestamp = new Date();
    const filename = `product-${Date.now()}-${i}.png`;
    const path = `${outputDir}/${filename}`;

    // Simular captura de imagen
    await simulateImageCapture(filename, path, args.imageQuality || config.scraping.imageQuality);

    const capturedImage: CapturedImage = {
      url: `${args.url}/image-${i}`,
      filename,
      path,
      size: estimateImageSize(args.imageQuality || config.scraping.imageQuality),
      format: config.scraping.screenshotFormat as 'png' | 'jpeg',
      timestamp,
      sourceUrl: args.url,
      productTitle: extractProductTitle(args.url)
    };

    capturedImages.push(capturedImage);
    console.log(`  📸 Capturada imagen ${i}/${imageCount}: ${filename}`);

    // Simular delay entre capturas
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`✅ Completado: ${capturedImages.length} imágenes capturadas`);
  return capturedImages;
}

/**
 * Simula la captura de una imagen (implementación mock)
 */
async function simulateImageCapture(_filename: string, path: string, quality: string): Promise<void> {
  // Simular creación de archivo de imagen
  const _mockImageData = generateMockImageData(quality);

  // En una implementación real, aquí usaríamos fs para guardar la imagen
  console.log(`💾 Guardando imagen: ${path} (${quality} quality)`);

  // Simular tiempo de guardado
  await new Promise(resolve => setTimeout(resolve, 200));
}

/**
 * Genera datos de imagen mock basados en la calidad
 */
function generateMockImageData(quality: string): Buffer {
  const sizes = {
    high: 1024 * 768 * 3, // ~2.3MB
    medium: 800 * 600 * 3, // ~1.4MB
    low: 640 * 480 * 3 // ~900KB
  };

  const size = sizes[quality as keyof typeof sizes] || sizes.medium;
  return Buffer.alloc(size, 'mock-image-data');
}

/**
 * Estima el tamaño de archivo basado en la calidad
 */
function estimateImageSize(quality: string): number {
  const sizes = {
    high: 2_300_000, // ~2.3MB
    medium: 1_400_000, // ~1.4MB
    low: 900_000 // ~900KB
  };

  return sizes[quality as keyof typeof sizes] || sizes.medium;
}

/**
 * Extrae un título de producto simulado de la URL
 */
function extractProductTitle(url: string): string {
  const domain = urlValidator.extractDomain(url);

  // Simular diferentes tipos de productos basados en el dominio
  const productTemplates = {
    'exito.com': ['Consola Nintendo Switch', 'Laptop Gamer ASUS', 'Smartphone Samsung Galaxy', 'Auriculares Bluetooth', 'Tablet iPad'],
    'falabella.com': ['Televisor LG 4K', 'Refrigerador Samsung', 'Lavadora Whirlpool', 'Microondas Oster', 'Cafetera Nespresso'],
    'linio.com': ['Cámara Canon', 'Drone DJI', 'Smartwatch Apple', 'Altavoz JBL', 'Teclado Mecánico'],
    'mercadolibre.com': ['PlayStation 5', 'Xbox Series X', 'Nintendo Switch OLED', 'Steam Deck', 'Gaming PC'],
  };

  const domainProducts = productTemplates[domain as keyof typeof productTemplates] || productTemplates['mercadolibre.com'];
  return domainProducts[Math.floor(Math.random() * domainProducts.length)];
}

/**
 * Asegura que un directorio exista
 */
async function ensureDirectory(path: string): Promise<void> {
  // En una implementación real, usaríamos fs-extra.ensureDir
  console.log(`📁 Verificando directorio: ${path}`);
}

/**
 * Herramienta para validación de URLs antes del scraping
 */
export function createUrlValidationTool(config: BodegonConfig) {
  return tool(
    "validateScrapingUrl",
    "Valida si una URL es adecuada para scraping de imágenes",
    {
      url: z.string().url("La URL debe ser válida"),
    },
    async (args, _extra) => {
      const validation = {
        isValid: true,
        isAllowed: true,
        domain: urlValidator.extractDomain(args.url || ''),
        issues: [] as string[],
        recommendations: [] as string[]
      };

      // Validar formato de URL
      if (!urlValidator.isValidUrl(args.url)) {
        validation.isValid = false;
        validation.issues.push("Formato de URL inválido");
      }

      // Validar dominio permitido
      if (!urlValidator.isAllowedDomain(args.url, config.scraping.allowedDomains)) {
        validation.isAllowed = false;
        validation.issues.push(`Dominio no permitido: ${validation.domain}`);
        validation.recommendations.push(`Dominios permitidos: ${config.scraping.allowedDomains.join(', ')}`);
      }

      // Recomendaciones
      if (!args.url.includes('/product') && !args.url.includes('/item') && !args.url.includes('/p/')) {
        validation.recommendations.push("Considera usar URLs de productos específicos para mejores resultados");
      }

      const status = validation.isValid && validation.isAllowed ? '✅' : '❌';

      return {
        content: [{
          type: "text",
          text: `${status} Validación de URL: ${args.url}\n` +
                `📌 Dominio: ${validation.domain}\n` +
                `✅ Formato válido: ${validation.isValid ? 'Sí' : 'No'}\n` +
                `🔐 Dominio permitido: ${validation.isAllowed ? 'Sí' : 'No'}\n` +
                (validation.issues.length > 0 ? `⚠️  Problemas: ${validation.issues.join(', ')}\n` : '') +
                (validation.recommendations.length > 0 ? `💡 Recomendaciones: ${validation.recommendations.join(', ')}` : '')
        }]
      };
    }
  );
}

/**
 * Herramienta para obtener estadísticas de scraping
 */
export function createScrapingStatsTool() {
  return tool(
    "getScrapingStats",
    "Obtiene estadísticas del proceso de scraping",
    {
      outputPath: z.string().optional().describe("Path al directorio para analizar"),
    },
    async (args, _extra) => {
      // Simular estadísticas
      const stats = {
        totalImages: 0,
        totalSize: 0,
        averageSize: 0,
        formatDistribution: {
          png: 0,
          jpeg: 0
        },
        qualityDistribution: {
          high: 0,
          medium: 0,
          low: 0
        },
        recentActivity: [] as string[]
      };

      // En una implementación real, leeríamos el sistema de archivos
      console.log(`📊 Analizando estadísticas de scraping${args.outputPath ? ` en ${args.outputPath}` : ''}`);

      return {
        content: [{
          type: "text",
          text: `📊 Estadísticas de Scraping:\n` +
                `📸 Total de imágenes: ${stats.totalImages}\n` +
                `💾 Tamaño total: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB\n` +
                `📏 Tamaño promedio: ${(stats.averageSize / 1024).toFixed(2)} KB\n` +
                `🖼️  Formatos: PNG (${stats.formatDistribution.png}), JPEG (${stats.formatDistribution.jpeg})\n` +
                `🎨 Calidades: Alta (${stats.qualityDistribution.high}), Media (${stats.qualityDistribution.medium}), Baja (${stats.qualityDistribution.low})`
        }]
      };
    }
  );
}

// Exportar todas las herramientas
export function createAllScrapingTools(config: BodegonConfig) {
  return [
    createImageScraperTool(config),
    createUrlValidationTool(config),
    createScrapingStatsTool()
  ];
}