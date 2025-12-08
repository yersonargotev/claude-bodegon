/**
 * Ejemplo básico de uso del Agente Bodegón Creator
 * Este ejemplo muestra cómo procesar una sola URL y crear una composición bodegón
 */

import { createBodegonAgent, type BodegonConfig } from '../src/index.js';

async function basicUsageExample() {
  console.log('🎨 Ejemplo Básico - Bodegón Creator Agent\n');

  try {
    // 1. Crear el agente con configuración por defecto
    console.log('📝 Creando agente...');
    const agent = createBodegonAgent();

    // 2. Definir la solicitud de procesamiento
    const request = {
      url: 'https://www.exito.com/tecnologia/consolas-y-videojuegos',
      prompt: 'Crea un bodegón elegante que muestre estos productos tecnológicos como piezas de arte contemporáneo con iluminación dramática',
      outputName: 'bodegon-gaming-elegante',
      customSettings: {
        maxImages: 3,
        imageQuality: 'high'
      }
    };

    console.log(`🎯 URL: ${request.url}`);
    console.log(`🎭 Estilo: ${request.prompt}\n`);

    // 3. Ejecutar el procesamiento
    console.log('🚀 Iniciando procesamiento...');
    let resultCount = 0;

    for await (const result of await agent.processSingle(request)) {
      resultCount++;

      if (result.status === 'success') {
        console.log(`✅ Resultado ${resultCount}:`);
        console.log(`  📸 Imágenes capturadas: ${result.capturedImages.length}`);
        console.log(`  🎨 Composiciones creadas: ${result.compositions.length}`);
        console.log(`  ⏱️  Tiempo de procesamiento: ${(result.processingTime / 1000).toFixed(2)} segundos`);

        // Mostrar detalles de las composiciones
        result.compositions.forEach((composition, index) => {
          console.log(`    ${index + 1}. ${composition.filename} (${(composition.size / 1024 / 1024).toFixed(2)} MB)`);
          console.log(`       📁 ${composition.path}`);
        });
      } else {
        console.log(`❌ Error en resultado ${resultCount}:`);
        console.log(`  🚫 ${result.errors.join(', ')}`);
      }

      console.log('');
    }

    console.log('🎉 Procesamiento completado exitosamente!');

  } catch (error) {
    console.error('❌ Error en el ejemplo básico:', error);
  }
}

// Ejecutar si este archivo es el punto de entrada
if (import.meta.url === `file://${process.argv[1]}`) {
  basicUsageExample();
}

export { basicUsageExample };