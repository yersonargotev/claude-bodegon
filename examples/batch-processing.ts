/**
 * Ejemplo de procesamiento por lotes con el Agente Bodegón Creator
 * Muestra cómo procesar múltiples URLs en paralelo o secuencialmente
 */

import { createBodegonAgent, type BatchProcessingRequest } from '../src/index.js';

async function batchProcessingExample() {
  console.log('📦 Ejemplo de Procesamiento por Lotes - Bodegón Creator Agent\n');

  try {
    // 1. Crear el agente
    console.log('📝 Creando agente...');
    const agent = createBodegonAgent();

    // 2. Definir las solicitudes de procesamiento
    const requests = [
      {
        url: 'https://www.exito.com/tecnologia/consolas-y-videojuegos',
        prompt: 'Crea un bodegón gamer con estilo futurista y neón',
        outputName: 'gaming-neon'
      },
      {
        url: 'https://www.falabella.com/tecnologia/laptops',
        prompt: 'Diseña una composición minimalista elegante para laptops de alta gama',
        outputName: 'laptops-minimalist'
      },
      {
        url: 'https://www.linio.com/tecnologia/smartphones',
        prompt: 'Crea un bodegón dramático con iluminación teatral para smartphones',
        outputName: 'smartphones-dramatic'
      },
      {
        url: 'https://www.mercadolibre.com/camera-photo',
        prompt: 'Composición fotográfica profesional con cámaras como obras de arte',
        outputName: 'cameras-professional'
      },
      {
        url: 'https://www.amazon.com/headphones-audio',
        prompt: 'Bodegón musical rítmico con audífonos y elementos sonoros abstractos',
        outputName: 'headphones-musical'
      }
    ];

    console.log(`📋 Procesando ${requests.length} URLs\n`);

    // 3. Configurar el procesamiento por lotes
    const batchConfig: BatchProcessingRequest = {
      requests,
      parallelProcessing: true,  // Cambiar a false para procesamiento secuencial
      maxConcurrent: 3,           // Número máximo de procesos simultáneos
      outputDirectory: './batch-output'
    };

    console.log(`⚙️  Configuración:`);
    console.log(`  🔄 Procesamiento paralelo: ${batchConfig.parallelProcessing ? 'Sí' : 'No'}`);
    console.log(`  🔢 Procesos concurrentes: ${batchConfig.maxConcurrent}`);
    console.log(`  📁 Directorio de salida: ${batchConfig.outputDirectory}\n`);

    // 4. Ejecutar el procesamiento por lotes
    console.log('🚀 Iniciando procesamiento por lotes...');

    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalErrors = 0;
    let totalImages = 0;
    let totalCompositions = 0;

    for await (const results of await agent.processBatch(batchConfig)) {
      totalProcessed += results.length;

      results.forEach(result => {
        if (result.status === 'success') {
          totalSuccessful++;
          totalImages += result.capturedImages.length;
          totalCompositions += result.compositions.length;

          console.log(`✅ ${result.url.split('/')[2] || 'URL'} - Éxito`);
          console.log(`   📸 ${result.capturedImages.length} imágenes, 🎨 ${result.compositions.length} composiciones`);

          // Mostrar composiciones creadas
          result.compositions.forEach(composition => {
            console.log(`     💾 ${composition.filename} (${(composition.processingTime / 1000).toFixed(1)}s)`);
          });
        } else {
          totalErrors++;
          console.log(`❌ ${result.url.split('/')[2] || 'URL'} - Error: ${result.errors[0]}`);
        }
      });
    }

    // 5. Mostrar resumen final
    console.log('\n📊 Resumen del Procesamiento por Lotes:');
    console.log(`📋 Total de URLs: ${requests.length}`);
    console.log(`✅ Exitosas: ${totalSuccessful}`);
    console.log(`❌ Con errores: ${totalErrors}`);
    console.log(`📸 Total de imágenes: ${totalImages}`);
    console.log(`🎨 Total de composiciones: ${totalCompositions}`);
    console.log(`📈 Tasa de éxito: ${((totalSuccessful / totalProcessed) * 100).toFixed(1)}%`);

    // 6. Obtener estado final del workflow
    const finalState = agent.getState();
    console.log(`\n⏱️  Tiempo total: ${Math.floor((Date.now() - finalState.startTime.getTime()) / 1000)} segundos`);

    if (finalState.errors.length > 0) {
      console.log('\n⚠️  Errores registrados:');
      finalState.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.step}] ${error.message}`);
      });
    }

  } catch (error) {
    console.error('❌ Error en el ejemplo de procesamiento por lotes:', error);
  }
}

async function compareParallelVsSequential() {
  console.log('🔬 Comparación: Procesamiento Paralelo vs Secuencial\n');

  const testRequests = [
    {
      url: 'https://www.exito.com/tecnologia/consolas-y-videojuegos',
      prompt: 'Bodegón gamer moderno',
      outputName: 'test-gaming'
    },
    {
      url: 'https://www.falabella.com/tecnologia/laptops',
      prompt: 'Bodegón minimalista para laptops',
      outputName: 'test-laptops'
    },
    {
      url: 'https://www.linio.com/tecnologia/smartphones',
      prompt: 'Bodegón elegante para smartphones',
      outputName: 'test-smartphones'
    }
  ];

  // Procesamiento secuencial
  console.log('1️⃣  Probando procesamiento SECUENCIAL...');
  const seqStart = Date.now();

  const agent1 = createBodegonAgent();
  const sequentialBatch = {
    requests: testRequests,
    parallelProcessing: false,
    maxConcurrent: 1
  };

  for await (const results of await agent1.processBatch(sequentialBatch)) {
    // Procesar resultados
  }

  const sequentialTime = Date.now() - seqStart;
  console.log(`⏱️  Tiempo secuencial: ${(sequentialTime / 1000).toFixed(2)} segundos\n`);

  // Procesamiento paralelo
  console.log('2️⃣  Probando procesamiento PARALELO...');
  const parStart = Date.now();

  const agent2 = createBodegonAgent();
  const parallelBatch = {
    requests: testRequests,
    parallelProcessing: true,
    maxConcurrent: 3
  };

  for await (const results of await agent2.processBatch(parallelBatch)) {
    // Procesar resultados
  }

  const parallelTime = Date.now() - parStart;
  console.log(`⏱️  Tiempo paralelo: ${(parallelTime / 1000).toFixed(2)} segundos\n`);

  // Comparación
  const improvement = ((sequentialTime - parallelTime) / sequentialTime) * 100;
  console.log('📊 Resultados de la Comparación:');
  console.log(`  🔄 Secuencial: ${(sequentialTime / 1000).toFixed(2)}s`);
  console.log(`  ⚡ Paralelo: ${(parallelTime / 1000).toFixed(2)}s`);
  console.log(`  📈 Mejora: ${improvement.toFixed(1)}% más rápido`);
}

// Ejecutar si este archivo es el punto de entrada
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2];

  if (mode === 'compare') {
    await compareParallelVsSequential();
  } else {
    await batchProcessingExample();
  }
}

export { batchProcessingExample, compareParallelVsSequential };