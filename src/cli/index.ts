#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import cliProgress from 'cli-progress';
import fs from 'fs-extra';
import path from 'path';

// Importar tipos y funciones del agente
import type {
  BodegonConfig,
  ProcessingRequest,
  BatchProcessingRequest,
  WorkflowState
} from '../agents/types.js';

import {
  createBodegonAgent,
  loadConfig,
  loadEnvironmentConfig,
  validateConfigFile,
  urlValidator,
  requestValidator
} from '../index.js';

/**
 * Aplicación CLI principal
 */
export function createCliApp(): Command {
  const program = new Command();

  program
    .name('bodegon-agent')
    .description('Agente para crear composiciones artísticas bodegón desde imágenes de productos')
    .version('1.0.0');

  // Comando interactivo
  program
    .command('interactive')
    .alias('i')
    .description('Modo interactivo para crear bodegones')
    .option('-c, --config <path>', 'Archivo de configuración', './config/default.yaml')
    .option('-e, --env <environment>', 'Entorno (development|production)', 'development')
    .action(async (options) => {
      await handleInteractiveMode(options);
    });

  // Comando para procesamiento individual
  program
    .command('process <url> <prompt>')
    .alias('p')
    .description('Procesar una sola URL')
    .option('-c, --config <path>', 'Archivo de configuración', './config/default.yaml')
    .option('-e, --env <environment>', 'Entorno (development|production)', 'development')
    .option('-o, --output <dir>', 'Directorio de salida personalizado')
    .option('-n, --name <name>', 'Nombre personalizado para el archivo de salida')
    .option('-q, --quality <quality>', 'Calidad de imagen (high|medium|low)', 'high')
    .option('-s, --style <style>', 'Estilo artístico', 'elegant')
    .action(async (url, prompt, options) => {
      await handleSingleProcessing(url, prompt, options);
    });

  // Comando para procesamiento por lotes
  program
    .command('batch <file>')
    .alias('b')
    .description('Procesar múltiples URLs desde archivo JSON')
    .option('-c, --config <path>', 'Archivo de configuración', './config/default.yaml')
    .option('-e, --env <environment>', 'Entorno (development|production)', 'development')
    .option('-o, --output <dir>', 'Directorio de salida')
    .option('-p, --parallel', 'Procesamiento paralelo', false)
    .option('-j, --jobs <number>', 'Número de trabajos concurrentes', '3')
    .action(async (file, options) => {
      await handleBatchProcessing(file, options);
    });

  // Comando de configuración
  program
    .command('config')
    .description('Gestión de configuración')
    .option('--validate <path>', 'Validar archivo de configuración')
    .option('--show <path>', 'Mostrar configuración actual')
    .option('--create <path>', 'Crear archivo de configuración por defecto')
    .action(async (options) => {
      await handleConfigCommands(options);
    });

  // Comando para validar URLs
  program
    .command('validate <url>')
    .alias('v')
    .description('Validar si una URL es adecuada para scraping')
    .option('-c, --config <path>', 'Archivo de configuración', './config/default.yaml')
    .action(async (url, options) => {
      await handleUrlValidation(url, options);
    });

  // Comando para sugerencias de prompts
  program
    .command('suggest')
    .alias('s')
    .description('Obtener sugerencias de prompts artísticos')
    .option('--style <style>', 'Estilo deseado (elegant|modern|vintage|minimalist|dramatic)')
    .option('--product-type <type>', 'Tipo de producto (technology|fashion|home|food|beauty|sports)')
    .option('--mood <mood>', 'Ambiente (professional|artistic|dramatic|serene|energetic|mysterious)')
    .action(async (options) => {
      await handlePromptSuggestions(options);
    });

  // Comando de estado
  program
    .command('status')
    .description('Mostrar estado del sistema y configuración')
    .option('-c, --config <path>', 'Archivo de configuración', './config/default.yaml')
    .action(async (options) => {
      await handleStatusCommand(options);
    });

  return program;
}

/**
 * Maneja el modo interactivo
 */
async function handleInteractiveMode(options: any): Promise<void> {
  console.log(chalk.blue.bold('\n🎨 Bodegón Creator Agent - Modo Interactivo\n'));

  try {
    // Cargar configuración
    const config = await loadConfiguration(options);

    // Mostrar configuración actual
    displayConfigSummary(config);

    // Preguntar modo de operación
    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: '¿Qué te gustaría hacer?',
        choices: [
          { name: '🎯 Procesar URL individual', value: 'single' },
          { name: '📦 Procesar múltiples URLs (lote)', value: 'batch' },
          { name: '🔧 Validar URL antes de procesar', value: 'validate' },
          { name: '💡 Obtener sugerencias de prompts', value: 'suggest' },
          { name: '⚙️  Ver configuración actual', value: 'config' },
          { name: '❌ Salir', value: 'exit' }
        ]
      }
    ]);

    switch (mode) {
      case 'single':
        await handleInteractiveSingle(config);
        break;
      case 'batch':
        await handleInteractiveBatch(config);
        break;
      case 'validate':
        await handleInteractiveValidation(config);
        break;
      case 'suggest':
        await handleInteractiveSuggestions();
        break;
      case 'config':
        displayConfigSummary(config, true);
        break;
      case 'exit':
        console.log(chalk.green('¡Hasta pronto! 🎨'));
        break;
    }
  } catch (error) {
    console.error(chalk.red('❌ Error en modo interactivo:'), error);
    process.exit(1);
  }
}

/**
 * Maneja procesamiento individual en modo interactivo
 */
async function handleInteractiveSingle(config: BodegonConfig): Promise<void> {
  console.log(chalk.blue('\n🎯 Modo de Procesamiento Individual\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'URL del producto o categoría:',
      validate: (input) => {
        if (!input.trim()) {
          return 'Por favor ingresa una URL';
        }
        if (!urlValidator.isValidUrl(input)) {
          return 'Por favor ingresa una URL válida';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'prompt',
      message: 'Describe el estilo artístico deseado:',
      validate: (input) => {
        if (!input.trim() || input.trim().length < 10) {
          return 'El prompt debe tener al menos 10 caracteres';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'style',
      message: 'Estilo artístico predefinido (opcional):',
      choices: [
        { name: '🎭 Elegante (clásico, sofisticado)', value: 'elegant' },
        { name: '🏙️ Moderno (líneas limpias, minimalista)', value: 'modern' },
        { name: '🎭 Dramático (alto contraste, teatral)', value: 'dramatic' },
        { name: '📜 Vintage (clásico, envejecido)', value: 'vintage' },
        { name: '⚪ Minimalista (simple, limpio)', value: 'minimalist' },
        { name: '🎨 Personalizado (usar prompt)', value: 'custom' }
      ],
      default: 'elegant'
    },
    {
      type: 'input',
      name: 'outputName',
      message: 'Nombre personalizado para el archivo (opcional):',
      when: (answers) => answers.style !== 'custom'
    },
    {
      type: 'list',
      name: 'quality',
      message: 'Calidad de imagen:',
      choices: [
        { name: '🔥 Alta (1920x1080)', value: 'high' },
        { name: '⚡ Media (1280x720)', value: 'medium' },
        { name: '💨 Baja (640x480)', value: 'low' }
      ],
      default: 'high'
    }
  ]);

  // Procesar la solicitud
  const request: ProcessingRequest = {
    url: answers.url.trim(),
    prompt: answers.prompt.trim(),
    outputName: answers.outputName,
    customSettings: {
      maxImages: 3,
      imageQuality: answers.quality
    }
  };

  await executeSingleRequest(request, config);
}

/**
 * Maneja procesamiento por lotes en modo interactivo
 */
async function handleInteractiveBatch(config: BodegonConfig): Promise<void> {
  console.log(chalk.blue('\n📦 Modo de Procesamiento por Lotes\n'));

  const { method } = await inquirer.prompt([
    {
      type: 'list',
      name: 'method',
      message: '¿Cómo quieres proporcionar las URLs?',
      choices: [
        { name: '📝 Ingresar manualmente', value: 'manual' },
        { name: '📁 Cargar desde archivo JSON', value: 'file' },
        { name: '↩️ Volver', value: 'back' }
      ]
    }
  ]);

  if (method === 'back') return;

  let requests: ProcessingRequest[] = [];

  if (method === 'manual') {
    requests = await handleManualBatchInput();
  } else if (method === 'file') {
    requests = await handleFileBatchInput();
  }

  if (requests.length === 0) {
    console.log(chalk.yellow('⚠️  No se proporcionaron URLs válidas'));
    return;
  }

  const { parallel, maxConcurrent } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'parallel',
      message: '¿Procesar en paralelo?',
      default: false
    },
    {
      type: 'number',
      name: 'maxConcurrent',
      message: 'Número máximo de procesos concurrentes:',
      default: 3,
      when: (answers) => answers.parallel,
      validate: (input) => input > 0 && input <= 10 || 'El número debe estar entre 1 y 10'
    }
  ]);

  const batchRequest: BatchProcessingRequest = {
    requests,
    parallelProcessing: parallel,
    maxConcurrent: maxConcurrent
  };

  await executeBatchRequest(batchRequest, config);
}

/**
 * Maneja entrada manual de URLs para procesamiento por lotes
 */
async function handleManualBatchInput(): Promise<ProcessingRequest[]> {
  const { urls } = await inquirer.prompt([
    {
      type: 'input',
      name: 'urls',
      message: 'Ingresa las URLs (una por línea, vacía para terminar):',
      validate: (input) => {
        const lines = input.trim().split('\n').filter(line => line.trim());
        return lines.length > 0 || 'Ingresa al menos una URL';
      }
    }
  ]);

  const urlLines = urls.trim().split('\n').map((line: string) => line.trim()).filter((line: string) => line);
  const requests: ProcessingRequest[] = [];

  for (const url of urlLines) {
    if (!urlValidator.isValidUrl(url)) {
      console.log(chalk.yellow(`⚠️  URL inválida omitida: ${url}`));
      continue;
    }

    const { prompt } = await inquirer.prompt([
      {
        type: 'input',
        name: 'prompt',
        message: `Prompt para ${url}:`,
        validate: (input) => input.trim().length >= 10 || 'El prompt debe tener al menos 10 caracteres'
      }
    ]);

    requests.push({
      url,
      prompt: prompt.trim()
    });
  }

  return requests;
}

/**
 * Maneja entrada desde archivo para procesamiento por lotes
 */
async function handleFileBatchInput(): Promise<ProcessingRequest[]> {
  const { filePath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'filePath',
      message: 'Ruta al archivo JSON:',
      validate: (input) => {
        if (!input.trim()) return 'Ingresa una ruta válida';
        if (!fs.existsSync(input.trim())) return 'El archivo no existe';
        return true;
      }
    }
  ]);

  try {
    const fileContent = await fs.readFile(filePath.trim(), 'utf-8');
    const data = JSON.parse(fileContent);

    if (!Array.isArray(data.requests)) {
      throw new Error('El archivo JSON debe contener un array en "requests"');
    }

    return data.requests;
  } catch (error) {
    console.error(chalk.red('❌ Error al leer archivo:'), error);
    return [];
  }
}

/**
 * Ejecuta una solicitud individual
 */
async function executeSingleRequest(request: ProcessingRequest, config: BodegonConfig): Promise<void> {
  const spinner = ora('🎨 Creando agente Bodegón...').start();

  try {
    const agent = createBodegonAgent({ config });
    spinner.text = '🚀 Iniciando procesamiento...';

    console.log(chalk.blue(`\n🎯 Procesando: ${request.url}`));
    console.log(chalk.gray(`📝 Prompt: ${request.prompt}`));

    const progressBar = new cliProgress.SingleBar({
      format: 'Progreso |{bar}| {percentage}% | {value}/{total} URLs',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true
    }, cliProgress.Presets.shades_grey);

    progressBar.start(1, 0);
    spinner.stop();

    let completedCount = 0;

    for await (const result of await agent.processSingle(request)) {
      completedCount++;
      progressBar.update(completedCount);

      if (result.status === 'success') {
        console.log(chalk.green(`\n✅ Completado en ${(result.processingTime / 1000).toFixed(2)}s`));
        console.log(chalk.blue(`📸 Imágenes capturadas: ${result.capturedImages.length}`));
        console.log(chalk.blue(`🎨 Composiciones creadas: ${result.compositions.length}`));

        if (result.compositions.length > 0) {
          const composition = result.compositions[0];
          console.log(chalk.green(`💾 Archivo guardado: ${composition.filename}`));
          console.log(chalk.gray(`📁 Ruta: ${composition.path}`));
        }
      } else {
        console.log(chalk.red(`\n❌ Error: ${result.errors.join(', ')}`));
      }
    }

    progressBar.stop();
    console.log(chalk.green('\n🎉 Procesamiento completado!'));

  } catch (error) {
    spinner.fail('❌ Error en el procesamiento');
    console.error(chalk.red('Detalles:'), error);
  }
}

/**
 * Ejecuta una solicitud por lotes
 */
async function executeBatchRequest(batch: BatchProcessingRequest, config: BodegonConfig): Promise<void> {
  const spinner = ora('🎨 Creando agente Bodegón...').start();

  try {
    const agent = createBodegonAgent({ config });
    spinner.stop();

    console.log(chalk.blue(`\n📦 Procesando ${batch.requests.length} URLs en modo ${batch.parallelProcessing ? 'paralelo' : 'secuencial'}`));

    const progressBar = new cliProgress.SingleBar({
      format: 'Progreso |{bar}| {percentage}% | {value}/{total} URLs',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true
    }, cliProgress.Presets.shades_grey);

    progressBar.start(batch.requests.length, 0);

    let completedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    for await (const results of await agent.processBatch(batch)) {
      completedCount += results.length;
      progressBar.update(completedCount);

      results.forEach(result => {
        if (result.status === 'success') {
          successCount++;
          console.log(chalk.green(`  ✅ ${result.url.split('/').pop() || result.url}`));
        } else {
          errorCount++;
          console.log(chalk.red(`  ❌ ${result.url.split('/').pop() || result.url}: ${result.errors[0]}`));
        }
      });
    }

    progressBar.stop();

    console.log(chalk.green(`\n🎉 Procesamiento del lote completado!`));
    console.log(chalk.blue(`📊 Estadísticas: ${successCount} exitosas, ${errorCount} con errores`));

  } catch (error) {
    spinner.fail('❌ Error en el procesamiento del lote');
    console.error(chalk.red('Detalles:'), error);
  }
}

/**
 * Carga la configuración desde archivo o entorno
 */
async function loadConfiguration(options: any): Promise<BodegonConfig> {
  try {
    if (options.config && options.config !== './config/default.yaml') {
      return await loadConfig(options.config);
    } else {
      return await loadEnvironmentConfig(options.env as 'development' | 'production');
    }
  } catch (error) {
    console.error(chalk.red('❌ Error cargando configuración:'), error);
    console.log(chalk.yellow('⚠️  Usando configuración por defecto'));

    // Configuración mínima por defecto
    return {
      agent: {
        name: 'bodegon-creator',
        model: 'sonnet',
        maxConcurrentJobs: 3,
        defaultTimeout: 300000
      },
      scraping: {
        maxImages: 3,
        imageQuality: 'high',
        screenshotFormat: 'png',
        allowedDomains: ['exito.com', 'falabella.com'],
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
  }
}

/**
 * Muestra un resumen de la configuración actual
 */
function displayConfigSummary(config: BodegonConfig, detailed: boolean = false): void {
  console.log(chalk.blue('\n⚙️  Configuración Actual:'));
  console.log(chalk.gray(`🤖 Modelo: ${config.agent.model}`));
  console.log(chalk.gray(`🔄 Jobs concurrentes: ${config.agent.maxConcurrentJobs}`));
  console.log(chalk.gray(`🖼️  Imágenes máximas: ${config.scraping.maxImages}`));
  console.log(chalk.gray(`🎨 Calidad: ${config.scraping.imageQuality}`));
  console.log(chalk.gray(`📁 Salida: ${config.composition.outputDirectory}`));
  console.log(chalk.gray(`🎭 Estilo por defecto: ${config.composition.defaultStyle}`));

  if (detailed) {
    console.log(chalk.blue('\n📋 Dominios permitidos:'));
    config.scraping.allowedDomains.forEach(domain => {
      console.log(chalk.gray(`  • ${domain}`));
    });
  }

  console.log('');
}

// Funciones de manejo de comandos específicos
async function handleSingleProcessing(url: string, prompt: string, options: any): Promise<void> {
  const config = await loadConfiguration(options);
  const request: ProcessingRequest = {
    url,
    prompt,
    outputName: options.name,
    customSettings: {
      outputDirectory: options.output,
      imageQuality: options.quality,
      maxImages: 3
    }
  };

  await executeSingleRequest(request, config);
}

async function handleBatchProcessing(file: string, options: any): Promise<void> {
  const config = await loadConfiguration(options);

  try {
    const fileContent = await fs.readFile(file, 'utf-8');
    const data = JSON.parse(fileContent);

    const batchRequest: BatchProcessingRequest = {
      requests: data.requests,
      parallelProcessing: options.parallel,
      maxConcurrent: parseInt(options.jobs),
      outputDirectory: options.output
    };

    await executeBatchRequest(batchRequest, config);
  } catch (error) {
    console.error(chalk.red('❌ Error leyendo archivo de lote:'), error);
  }
}

async function handleConfigCommands(options: any): Promise<void> {
  if (options.validate) {
    const validation = await validateConfigFile(options.validate);
    if (validation.isValid) {
      console.log(chalk.green('✅ Configuración válida'));
    } else {
      console.log(chalk.red('❌ Configuración inválida:'));
      validation.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
    }
  } else if (options.show) {
    const config = await loadConfig(options.show);
    displayConfigSummary(config, true);
  } else if (options.create) {
    // Crear archivo de configuración por defecto
    const defaultConfig = await loadConfiguration({});
    const yamlContent = `# Configuración generada automáticamente\n# Modifica según tus necesidades\n\nagent:\n  name: "${defaultConfig.agent.name}"\n  model: "${defaultConfig.agent.model}"\n  maxConcurrentJobs: ${defaultConfig.agent.maxConcurrentJobs}\n\nscraping:\n  maxImages: ${defaultConfig.scraping.maxImages}\n  imageQuality: "${defaultConfig.scraping.imageQuality}"\n  allowedDomains:\n${defaultConfig.scraping.allowedDomains.map(d => `    - "${d}"`).join('\n')}\n\ncomposition:\n  defaultStyle: "${defaultConfig.composition.defaultStyle}"\n  outputDirectory: "${defaultConfig.composition.outputDirectory}"\n  outputFormat: "${defaultConfig.composition.outputFormat}"\n`;

    await fs.writeFile(options.create, yamlContent);
    console.log(chalk.green(`✅ Configuración creada: ${options.create}`));
  }
}

async function handleUrlValidation(url: string, options: any): Promise<void> {
  const config = await loadConfiguration(options);

  console.log(chalk.blue(`🔍 Validando URL: ${url}`));

  const isValid = urlValidator.isValidUrl(url);
  const isAllowed = urlValidator.isAllowedDomain(url, config.scraping.allowedDomains);

  if (isValid && isAllowed) {
    console.log(chalk.green('✅ URL válida y permitida para scraping'));
  } else {
    if (!isValid) {
      console.log(chalk.red('❌ URL inválida'));
    }
    if (!isAllowed) {
      console.log(chalk.red('❌ Dominio no permitido'));
      console.log(chalk.yellow(`Dominios permitidos: ${config.scraping.allowedDomains.join(', ')}`));
    }
  }
}

async function handlePromptSuggestions(options: any): Promise<void> {
  // Simular sugerencias de prompts
  const suggestions = [
    {
      title: "Bodegón Clásico Elegante",
      prompt: "Crea un bodegón clásico con iluminación suave y composición equilibrada",
      style: options.style || "elegant"
    },
    {
      title: "Composición Moderna Minimalista",
      prompt: "Diseña una composición moderna con líneas limpias y espacios negativos",
      style: options.style || "modern"
    },
    {
      title: "Bodegón Dramático",
      prompt: "Crea una composición dramática con iluminación teatral y alto contraste",
      style: options.style || "dramatic"
    }
  ];

  console.log(chalk.blue('\n💡 Sugerencias de Prompts Artísticos:\n'));

  suggestions.forEach((suggestion, index) => {
    console.log(chalk.green(`${index + 1}. ${suggestion.title}`));
    console.log(chalk.gray(`   ${suggestion.prompt}`));
    console.log(chalk.blue(`   🎭 Estilo: ${suggestion.style}\n`));
  });
}

async function handleStatusCommand(options: any): Promise<void> {
  const config = await loadConfiguration(options);

  console.log(chalk.blue('\n📊 Estado del Sistema:\n'));
  console.log(chalk.gray(`🔧 Versión del agente: 1.0.0`));
  console.log(chalk.gray(`🟢 Node.js: ${process.version}`));
  console.log(chalk.gray(`💾 Memoria: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`));
  console.log(chalk.gray(`⏱️  Uptime: ${Math.floor(process.uptime() / 60)} minutos`));

  displayConfigSummary(config, false);
}

async function handleInteractiveValidation(config: BodegonConfig): Promise<void> {
  const { url } = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'URL a validar:',
      validate: (input) => input.trim().length > 0 || 'Ingresa una URL'
    }
  ]);

  await handleUrlValidation(url.trim(), { config });
}

async function handleInteractiveSuggestions(): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'style',
      message: 'Estilo deseado:',
      choices: ['elegant', 'modern', 'vintage', 'dramatic', 'minimalist']
    },
    {
      type: 'list',
      name: 'productType',
      message: 'Tipo de producto:',
      choices: ['technology', 'fashion', 'home', 'food', 'beauty', 'sports']
    }
  ]);

  await handlePromptSuggestions(answers);
}

// Ejecutar la CLI si este archivo es el punto de entrada
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createCliApp();
  app.parse();
}