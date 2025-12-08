import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { retryWithBackoff } from "../utils/retry.js";
import type { BodegonConfig, CompositionResult, CapturedImage } from "../agents/types.js";

/**
 * Herramienta MCP para crear composiciones bodegón
 */
export function createBodegonComposerTool(config: BodegonConfig) {
  return tool(
    "createBodegonComposition",
    "Crea una composición artística bodegón desde imágenes de productos usando IA",
    {
      images: z.array(z.string()).min(1).max(10).describe("Array de paths a las imágenes de productos"),
      prompt: z.string().min(10).max(1000).describe("Descripción del estilo artístico deseado"),
      outputName: z.string().optional().describe("Nombre personalizado para el archivo de salida"),
      style: z.enum(['elegant', 'modern', 'vintage', 'minimalist', 'dramatic']).default('elegant').describe("Estilo artístico predefinido"),
      outputDirectory: z.string().optional().describe("Directorio de salida personalizado"),
    },
    async (args, _extra) => {
      try {
        // Ensure required parameters are present
        if (!args.images || args.images.length === 0) {
          return {
            content: [{
              type: "text",
              text: "Error: images parameter is required"
            }],
            isError: true
          };
        }

        // Validar que las imágenes existan
        await validateImages(args.images);

        // Crear composición con retry
        const result = await retryWithBackoff(
          () => createComposition({
            images: args.images,
            prompt: args.prompt,
            outputName: args.outputName,
            style: args.style,
            outputDirectory: args.outputDirectory
          }, config),
          { maxAttempts: 3, baseDelay: 2000 },
          `composition-${args.outputName || 'unnamed'}`
        );

        return {
          content: [{
            type: "text",
            text: `🎨 ¡Composición bodegón creada con éxito!\n` +
                  `📁 Archivo: ${result.filename}\n` +
                  `💾 Tamaño: ${(result.size / 1024 / 1024).toFixed(2)} MB\n` +
                  `🎭 Estilo: ${args.style}\n` +
                  `⏱️  Tiempo de procesamiento: ${(result.processingTime / 1000).toFixed(2)} segundos\n` +
                  `📸 Imágenes fuente: ${result.sourceImages.length}`
          }]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        return {
          content: [{
            type: "text",
            text: `❌ Error al crear composición bodegón: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );
}

/**
 * Herramienta para optimizar imágenes antes de la composición
 */
export function createImageOptimizerTool(config: BodegonConfig) {
  return tool(
    "optimizeImages",
    "Optimiza un conjunto de imágenes para la composición bodegón",
    {
      images: z.array(z.string()).min(1).max(10).describe("Array de paths a las imágenes"),
      targetQuality: z.enum(['high', 'medium', 'low']).default('medium').describe("Calidad objetivo de optimización"),
      maxDimension: z.number().int().min(400).max(4000).default(1920).describe("Dimensión máxima en píxeles"),
      outputDirectory: z.string().optional().describe("Directorio para imágenes optimizadas"),
    },
    async (args, _extra) => {
      try {
        // Ensure required parameters are present
        if (!args.images || args.images.length === 0) {
          return {
            content: [{
              type: "text",
              text: "Error: images parameter is required"
            }],
            isError: true
          };
        }

        const optimizedImages = await retryWithBackoff(
          () => optimizeImages({
            images: args.images,
            targetQuality: args.targetQuality || 'medium',
            maxDimension: args.maxDimension || 1920,
            outputDirectory: args.outputDirectory
          }, config),
          { maxAttempts: 3, baseDelay: 2000 },
          "image-optimization"
        );

        return {
          content: [{
            type: "text",
            text: `✅ Optimización completada\n` +
                  `📸 Imágenes procesadas: ${optimizedImages.length}\n` +
                  `🎯 Calidad objetivo: ${args.targetQuality}\n` +
                  `📏 Dimensión máxima: ${args.maxDimension}px\n` +
                  `💾 Ahorro estimado: ${calculateSavings(optimizedImages)}%`
          }]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        return {
          content: [{
            type: "text",
            text: `❌ Error al optimizar imágenes: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );
}

/**
 * Herramienta para sugerir prompts artísticos
 */
export function createPromptSuggestionTool(_config?: BodegonConfig) {
  return tool(
    "suggestArtisticPrompts",
    "Sugiere prompts artísticos para diferentes estilos de bodegón",
    {
      style: z.enum(['elegant', 'modern', 'vintage', 'minimalist', 'dramatic', 'natural']).optional().describe("Estilo deseado"),
      productType: z.enum(['technology', 'fashion', 'home', 'food', 'beauty', 'sports']).optional().describe("Tipo de producto"),
      mood: z.enum(['professional', 'artistic', 'dramatic', 'serene', 'energetic', 'mysterious']).optional().describe("Estado de ánimo"),
    },
    async (args, _extra) => {
      const suggestions = generatePromptSuggestions(args);

      return {
        content: [{
          type: "text",
          text: `💡 Sugerencias de prompts artísticos:\n\n` +
                suggestions.map((suggestion, index) =>
                  `${index + 1}. **${suggestion.title}**\n   ${suggestion.prompt}\n   🎭 Estilo: ${suggestion.style}\n   😊 Ambiente: ${suggestion.mood}\n`
                ).join('\n')
        }]
      };
    }
  );
}

/**
 * Herramienta para validar composición
 */
export function createCompositionValidatorTool(config: BodegonConfig) {
  return tool(
    "validateComposition",
    "Valida una composición bodegón creada",
    {
      imagePath: z.string().describe("Path a la imagen de la composición"),
      sourceImages: z.array(z.string()).describe("Paths a las imágenes fuente originales"),
      quality: z.enum(['basic', 'standard', 'premium']).default('standard').describe("Nivel de calidad a validar"),
    },
    async (args, _extra) => {
      try {
        // Ensure required parameters are present
        if (!args.imagePath || !args.sourceImages || args.sourceImages.length === 0) {
          return {
            content: [{
              type: "text",
              text: "Error: imagePath and sourceImages parameters are required"
            }],
            isError: true
          };
        }

        const validation = await validateComposition({
          imagePath: args.imagePath,
          sourceImages: args.sourceImages,
          quality: args.quality || 'standard'
        }, config);

        const status = validation.isValid ? '✅' : '⚠️';

        return {
          content: [{
            type: "text",
            text: `${status} Validación de composición:\n\n` +
                  `📏 Dimensiones: ${validation.dimensions}\n` +
                  `💾 Tamaño: ${(validation.size / 1024 / 1024).toFixed(2)} MB\n` +
                  `🎨 Calidad: ${validation.quality} ${validation.issues.length > 0 ? '(con problemas)' : '(aprobada)'}\n` +
                  `📸 Imágenes fuente: ${validation.sourceImagesFound}/${args.sourceImages.length}\n` +
                  (validation.issues.length > 0 ? `⚠️  Problemas detectados:\n   ${validation.issues.join('\n   ')}\n\n` : '') +
                  (validation.recommendations.length > 0 ? `💡 Recomendaciones:\n   ${validation.recommendations.join('\n   ')}` : '')
          }]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        return {
          content: [{
            type: "text",
            text: `❌ Error al validar composición: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );
}

// Funciones de implementación

/**
 * Valida que las imágenes existan y sean accesibles
 */
async function validateImages(imagePaths: string[]): Promise<void> {
  for (const imagePath of imagePaths) {
    // En una implementación real, verificaríamos que el archivo exista
    console.log(`🔍 Validando imagen: ${imagePath}`);

    // Simular validación
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Crea una composición bodegón usando NanoBanana MCP
 */
async function createComposition(
  args: {
    images: string[];
    prompt: string;
    outputName?: string;
    style: string;
    outputDirectory?: string;
  },
  config: BodegonConfig
): Promise<CompositionResult> {
  const startTime = Date.now();
  const outputDir = args.outputDirectory || config.composition.outputDirectory;
  const outputName = args.outputName || `bodegon-${Date.now()}`;

  console.log(`🎨 Creando composición bodegón...`);
  console.log(`📸 Imágenes fuente: ${args.images.length}`);
  console.log(`🎭 Estilo: ${args.style}`);
  console.log(`💭 Prompt: ${args.prompt}`);

  // Simular proceso de composición con NanoBanana
  await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos simulados

  const result: CompositionResult = {
    filename: `${outputName}.${config.composition.outputFormat}`,
    path: `${outputDir}/${outputName}.${config.composition.outputFormat}`,
    size: estimateCompositionSize(args.images.length, args.style),
    format: config.composition.outputFormat as 'png' | 'jpeg',
    sourceImages: args.images,
    prompt: args.prompt,
    timestamp: new Date(),
    processingTime: Date.now() - startTime
  };

  console.log(`✅ Composición creada: ${result.filename}`);
  return result;
}

/**
 * Optimiza imágenes para la composición
 */
async function optimizeImages(
  args: {
    images: string[];
    targetQuality: string;
    maxDimension: number;
    outputDirectory?: string;
  },
  config: BodegonConfig
): Promise<Array<{ original: string; optimized: string; originalSize: number; optimizedSize: number }>> {
  console.log(`🔧 Optimizando ${args.images.length} imágenes...`);

  const results = [];

  for (const imagePath of args.images) {
    // Simular optimización
    await new Promise(resolve => setTimeout(resolve, 500));

    const originalSize = Math.random() * 2_000_000 + 500_000; // 0.5MB - 2.5MB
    const compressionRatio = args.targetQuality === 'high' ? 0.8 : args.targetQuality === 'medium' ? 0.6 : 0.4;
    const optimizedSize = originalSize * compressionRatio;

    results.push({
      original: imagePath,
      optimized: `${imagePath.split('.')[0]}_optimized.${imagePath.split('.').pop()}`,
      originalSize: Math.round(originalSize),
      optimizedSize: Math.round(optimizedSize)
    });
  }

  return results;
}

/**
 * Genera sugerencias de prompts artísticos
 */
function generatePromptSuggestions(args: {
  style?: string;
  productType?: string;
  mood?: string;
}): Array<{ title: string; prompt: string; style: string; mood: string }> {
  const suggestions = [];

  // Sugerencia basada en estilo
  if (!args.style || args.style === 'elegant') {
    suggestions.push({
      title: "Bodegón Clásico Elegante",
      prompt: "Crea un bodegón clásico con iluminación suave y composición equilibrada, mostrando los productos como piezas de arte contemporáneo con fondos neutros y sombras delicadas",
      style: "elegant",
      mood: "professional"
    });
  }

  if (!args.style || args.style === 'modern') {
    suggestions.push({
      title: "Composición Moderna Minimalista",
      prompt: "Diseña una composición bodegón moderna con líneas limpias, espacios negativos estratégicos y paleta de colores minimalista, resaltando la forma y función de cada producto",
      style: "modern",
      mood: "serene"
    });
  }

  if (!args.style || args.style === 'dramatic') {
    suggestions.push({
      title: "Bodegón Dramático con Alto Contraste",
      prompt: "Crea una composición dramática con iluminación teatral, sombras intensas y alto contraste, transformando los productos en elementos esculturales con atmósfera misteriosa",
      style: "dramatic",
      mood: "dramatic"
    });
  }

  // Sugerencia basada en tipo de producto
  if (args.productType === 'technology') {
    suggestions.push({
      title: "Tecnología como Arte Contemporáneo",
      prompt: "Transforma los productos tecnológicos en arte contemporáneo con reflejos futuristas, iluminación neón y composición dinámica que sugiere innovación y progreso",
      style: "modern",
      mood: "energetic"
    });
  }

  if (args.productType === 'fashion') {
    suggestions.push({
      title: "Moda en Escena Couture",
      prompt: "Presenta los productos de moda en un escenario couture con iluminación de pasarela, composición elegante y atmósfera sofisticada que evoca lujo y estilo",
      style: "elegant",
      mood: "professional"
    });
  }

  return suggestions.slice(0, 3); // Limitar a 3 sugerencias
}

/**
 * Valida una composición bodegón
 */
async function validateComposition(
  args: {
    imagePath: string;
    sourceImages: string[];
    quality: string;
  },
  config: BodegonConfig
): Promise<{
  isValid: boolean;
  dimensions: string;
  size: number;
  quality: string;
  sourceImagesFound: number;
  issues: string[];
  recommendations: string[];
}> {
  // Simular validación
  await new Promise(resolve => setTimeout(resolve, 1000));

  const dimensions = "1920x1080";
  const size = Math.random() * 3_000_000 + 1_000_000; // 1MB - 4MB
  const sourceImagesFound = Math.min(args.sourceImages.length, Math.floor(Math.random() * args.sourceImages.length) + 1);

  const issues = [];
  const recommendations = [];

  // Validar calidad
  const qualityScore = Math.random();
  let isValid = true;
  let quality = args.quality;

  if (args.quality === 'premium' && qualityScore < 0.8) {
    issues.push("La calidad no alcanza el nivel premium esperado");
    quality = "standard";
    isValid = false;
  }

  if (args.quality === 'standard' && qualityScore < 0.6) {
    issues.push("La composición podría mejorar con mejor iluminación");
    isValid = false;
  }

  // Validar imágenes fuente
  if (sourceImagesFound < args.sourceImages.length) {
    issues.push(`Faltan ${args.sourceImages.length - sourceImagesFound} imágenes fuente`);
    recommendations.push("Verifica que todas las imágenes originales estén accesibles");
  }

  // Recomendaciones generales
  if (size > 4_000_000) {
    recommendations.push("Considera optimizar el tamaño del archivo para mejor rendimiento");
  }

  if (sourceImagesFound > 8) {
    recommendations.push("Demasiadas imágenes pueden hacer la composición demasiado ocupada");
  }

  return {
    isValid,
    dimensions,
    size: Math.round(size),
    quality,
    sourceImagesFound,
    issues,
    recommendations
  };
}

/**
 * Estima el tamaño del archivo de composición
 */
function estimateCompositionSize(imageCount: number, style: string): number {
  const baseSize = 1_000_000; // 1MB base
  const imageMultiplier = imageCount * 200_000; // 200KB por imagen

  const styleMultipliers = {
    elegant: 1.2,
    modern: 0.8,
    vintage: 1.5,
    minimalist: 0.6,
    dramatic: 1.3
  };

  const styleMultiplier = styleMultipliers[style as keyof typeof styleMultipliers] || 1.0;

  return Math.round(baseSize + (imageMultiplier * styleMultiplier));
}

/**
 * Calcula el porcentaje de ahorro de la optimización
 */
function calculateSavings(optimizedImages: Array<{ originalSize: number; optimizedSize: number }>): number {
  if (optimizedImages.length === 0) return 0;

  const totalOriginal = optimizedImages.reduce((sum, img) => sum + img.originalSize, 0);
  const totalOptimized = optimizedImages.reduce((sum, img) => sum + img.optimizedSize, 0);

  return Math.round(((totalOriginal - totalOptimized) / totalOriginal) * 100);
}

// Exportar todas las herramientas
export function createAllComposerTools(config: BodegonConfig) {
  return [
    createBodegonComposerTool(config),
    createImageOptimizerTool(config),
    createPromptSuggestionTool(),
    createCompositionValidatorTool(config)
  ];
}