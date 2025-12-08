/**
 * Ejemplo avanzado de configuración y personalización del Agente Bodegón Creator
 * Muestra cómo configurar opciones personalizadas, manejar errores y personalizar el workflow
 */

import { createBodegonAgent, loadEnvironmentConfig, type BodegonConfig } from '../src/index.js';

async function advancedConfigurationExample() {
  console.log('⚙️  Ejemplo Avanzado - Configuración Personalizada\n');

  try {
    // 1. Configuración personalizada
    console.log('📝 Cargando configuración personalizada...');
    const config: BodegonConfig = await loadEnvironmentConfig('production');

    // Personalizar configuración específica
    config.scraping.maxImages = 5;
    config.scraping.imageQuality = 'high';
    config.composition.maxImagesPerComposition = 8;
    config.retry.maxAttempts = 5;
    config.progress.detailedOutput = true;

    console.log('🎛️  Configuración avanzada aplicada:');
    console.log(`  📸 Máximo de imágenes: ${config.scraping.maxImages}`);
    console.log(`  🎨 Máximo en composición: ${config.composition.maxImagesPerComposition}`);
    console.log(`  🔄 Reintentos: ${config.retry.maxAttempts}`);
    console.log(`  📊 Output detallado: ${config.progress.detailedOutput}\n`);

    // 2. Crear agente con callbacks personalizados
    console.log('🤖 Creando agente con callbacks personalizados...');
    const agent = createBodegonAgent({
      config,
      onProgress: (state) => {
        // Callback personalizado para seguimiento de progreso
        if (state.step !== 'setup') {
          const percentage = state.totalRequests > 0
            ? Math.round((state.completedRequests / state.totalRequests) * 100)
            : 0;

          console.log(`📈 Progreso: ${percentage}% | ${state.completedRequests}/${state.totalRequests} | 📸 ${state.imagesCollected} imágenes | 🎨 ${state.compositionsCreated} composiciones`);
        }
      },
      onError: (error, context) => {
        // Callback personalizado para manejo de errores
        console.error(`🚨 Error en ${context}: ${error.message}`);
      }
    });

    // 3. Solicitudes complejas con configuración personalizada
    const complexRequests = [
      {
        url: 'https://www.exito.com/tecnologia/consolas-y-videojuegos',
        prompt: 'Crea un bodegón cyberpunk con iluminación neón y atmósfera futurista',
        outputName: 'gaming-cyberpunk',
        customSettings: {
          maxImages: 4,
          imageQuality: 'high',
          outputDirectory: './advanced-output/gaming'
        }
      },
      {
        url: 'https://www.falabella.com/hogar/decoracion',
        prompt: 'Bodegón minimalista escandinavo con iluminación natural suave',
        outputName: 'home-scandinavian',
        customSettings: {
          maxImages: 3,
          imageQuality: 'medium',
          outputDirectory: './advanced-output/home'
        }
      }
    ];

    console.log(`📦 Procesando ${complexRequests.length} solicitudes complejas...\n`);

    // 4. Ejecutar con monitoreo avanzado
    const startTime = Date.now();
    let totalImages = 0;
    let totalCompositions = 0;
    const errors: Array<{request: string; error: string}> = [];

    console.log('🚀 Iniciando procesamiento avanzado...');

    for await (const request of complexRequests) {
      try {
        for await (const result of await agent.processSingle(request)) {
          if (result.status === 'success') {
            totalImages += result.capturedImages.length;
            totalCompositions += result.compositions.length;

            // Análisis detallado de resultados
            console.log(`\n✅ Análisis detallado de ${result.outputName}:`);
            console.log(`  📸 Calidad de imágenes: ${analyzeImageQuality(result.capturedImages)}`);
            console.log(`  🎨 Complejidad de composición: ${analyzeCompositionComplexity(result.compositions)}`);
            console.log(`  ⚡ Eficiencia: ${calculateEfficiency(result.processingTime, result.capturedImages.length)}`);
          } else {
            errors.push({
              request: request.url,
              error: result.errors.join('; ')
            });
          }
        }
      } catch (error) {
        errors.push({
          request: request.url,
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    const totalTime = Date.now() - startTime;

    // 5. Reporte final avanzado
    console.log('\n📊 Reporte Avanzado de Ejecución:');
    console.log(`⏱️  Tiempo total: ${(totalTime / 1000).toFixed(2)} segundos`);
    console.log(`📸 Total de imágenes: ${totalImages}`);
    console.log(`🎨 Total de composiciones: ${totalCompositions}`);
    console.log(`🚨 Errores: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Detalles de errores:');
      errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.request.split('/')[2]}: ${error.error}`);
      });
    }

    // Métricas de rendimiento
    const avgTimePerImage = totalImages > 0 ? totalTime / totalImages : 0;
    const avgTimePerComposition = totalCompositions > 0 ? totalTime / totalCompositions : 0;

    console.log('\n📈 Métricas de Rendimiento:');
    console.log(`  📸 Tiempo promedio por imagen: ${avgTimePerImage.toFixed(0)}ms`);
    console.log(`  🎨 Tiempo promedio por composición: ${avgTimePerComposition.toFixed(0)}ms`);
    console.log(`  🚀 Throughput: ${(totalCompositions / (totalTime / 1000)).toFixed(2)} composiciones/segundo`);

  } catch (error) {
    console.error('❌ Error en el ejemplo avanzado:', error);
  }
}

// Funciones de análisis avanzado
function analyzeImageQuality(images: any[]): string {
  if (images.length === 0) return 'No hay imágenes';

  const avgSize = images.reduce((sum, img) => sum + img.size, 0) / images.length;
  const avgSizeMB = avgSize / 1024 / 1024;

  if (avgSizeMB > 2) return 'Alta calidad (>2MB promedio)';
  if (avgSizeMB > 1) return 'Calidad media (1-2MB promedio)';
  return 'Calidad básica (<1MB promedio)';
}

function analyzeCompositionComplexity(compositions: any[]): string {
  if (compositions.length === 0) return 'No hay composiciones';

  const avgProcessingTime = compositions.reduce((sum, comp) => sum + comp.processingTime, 0) / compositions.length;

  if (avgProcessingTime > 5000) return 'Alta complejidad (>5s)';
  if (avgProcessingTime > 3000) return 'Complejidad media (3-5s)';
  return 'Baja complejidad (<3s)';
}

function calculateEfficiency(processingTime: number, imageCount: number): string {
  if (imageCount === 0) return 'Sin imágenes para calcular eficiencia';

  const timePerImage = processingTime / imageCount;
  const efficiency = 100 - Math.min((timePerImage / 100) * 10, 90); // Normalizar a 0-100

  if (efficiency > 80) return `Muy eficiente (${efficiency.toFixed(0)}%)`;
  if (efficiency > 60) return `Eficiente (${efficiency.toFixed(0)}%)`;
  if (efficiency > 40) return `Moderadamente eficiente (${efficiency.toFixed(0)}%)`;
  return `Poco eficiente (${efficiency.toFixed(0)}%)`;
}

async function errorHandlingAndRecoveryExample() {
  console.log('\n🛡️  Ejemplo de Manejo de Errores y Recuperación\n');

  try {
    const config = await loadEnvironmentConfig('development');
    config.retry.maxAttempts = 2; // Reducir para demostrar errores

    const agent = createBodegonAgent({
      config,
      onError: (error, context) => {
        console.log(`🔄 Callback de error - Contexto: ${context}`);
        console.log(`   Mensaje: ${error.message}`);
        console.log(`   Stack: ${error.stack?.split('\n')[1] || 'N/A'}`);
      }
    });

    // Solicitudes con URLs potencialmente problemáticas
    const problematicRequests = [
      {
        url: 'https://invalid-url-that-does-not-exist.com/product',
        prompt: 'Este debería fallar',
        outputName: 'test-invalid-url'
      },
      {
        url: 'https://httpbin.org/status/500',  // Simula error de servidor
        prompt: 'Este también debería fallar',
        outputName: 'test-server-error'
      },
      {
        url: 'https://www.exito.com/tecnologia/consolas-y-videojuegos',
        prompt: 'Este debería funcionar',
        outputName: 'test-working-url'
      }
    ];

    console.log('🚨 Probando manejo de errores con URLs problemáticas...\n');

    let successCount = 0;
    let errorCount = 0;

    for await (const request of problematicRequests) {
      try {
        console.log(`🎯 Probando: ${request.url}`);

        for await (const result of await agent.processSingle(request)) {
          if (result.status === 'success') {
            successCount++;
            console.log(`✅ Éxito: ${request.outputName}`);
          } else {
            errorCount++;
            console.log(`❌ Error esperado: ${request.outputName} - ${result.errors[0]}`);
          }
        }
      } catch (error) {
        errorCount++;
        console.log(`🔄 Error capturado: ${request.outputName} - ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }

      console.log('');
    }

    console.log('📊 Resumen de manejo de errores:');
    console.log(`✅ Exitosas: ${successCount}`);
    console.log(`❌ Con errores: ${errorCount}`);
    console.log(`📈 Tasa de recuperación: ${((successCount / (successCount + errorCount)) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Error en el ejemplo de manejo de errores:', error);
  }
}

// Ejecutar si este archivo es el punto de entrada
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2];

  if (mode === 'errors') {
    await errorHandlingAndRecoveryExample();
  } else {
    await advancedConfigurationExample();
  }
}

export { advancedConfigurationExample, errorHandlingAndRecoveryExample };