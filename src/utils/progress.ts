import type { WorkflowState, IProgressTracker } from '../agents/types.js';

type WorkflowStep = WorkflowState['step'];
import { v4 as uuidv4 } from 'uuid';

/**
 * Implementación del tracker de progreso del workflow
 */
class ProgressTrackerImpl implements IProgressTracker {
  private state: WorkflowState;

  constructor() {
    this.state = {
      step: 'setup' as const,
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
  }

  updateProgress(updates: Partial<WorkflowState>): void {
    this.state = { ...this.state, ...updates };

    // Calcular automáticamente ETA si se muestra
    if (this.state.totalRequests > 0 && this.state.completedRequests > 0) {
      const elapsedTime = Date.now() - this.state.startTime.getTime();
      const averageTimePerRequest = elapsedTime / this.state.completedRequests;
      const remainingRequests = this.state.totalRequests - this.state.completedRequests;
      const estimatedRemainingTime = averageTimePerRequest * remainingRequests;

      this.state.eta = this.formatDuration(estimatedRemainingTime);
    }
  }

  addError(error: string, step?: string, requestId?: string): void {
    const errorEntry = {
      step: step || this.state.step,
      message: error,
      timestamp: new Date(),
      requestId,
    };

    this.state.errors.push(errorEntry);
  }

  getProgress(): WorkflowState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      step: 'setup' as const,
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
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

/**
 * Interfaz para formateador de progreso
 */
export interface IProgressFormatter {
  format(state: WorkflowState): string;
  update(state: WorkflowState): void;
}

/**
 * Formateador simple de progreso en consola
 */
class ConsoleProgressFormatterImpl implements IProgressFormatter {
  private lastOutput = '';

  format(state: WorkflowState): string {
    const percentage = state.totalRequests > 0
      ? Math.round((state.completedRequests / state.totalRequests) * 100)
      : 0;

    const progressBar = this.createProgressBar(percentage, 20);
    const timeElapsed = this.formatTime(Date.now() - state.startTime.getTime());
    const timeRemaining = state.eta || 'Calculando...';

    return `\r${progressBar} ${percentage}% | Completado: ${state.completedRequests}/${state.totalRequests} | Imágenes: ${state.imagesCollected} | Composiciones: ${state.compositionsCreated} | Tiempo: ${timeElapsed} | Restante: ${timeRemaining}`;
  }

  update(state: WorkflowState): void {
    const output = this.format(state);

    // Solo actualizar si el output ha cambiado para evitar flickering
    if (output !== this.lastOutput) {
      process.stdout.write(output);
      this.lastOutput = output;
    }

    // Nueva línea cuando está completo
    if (state.completedRequests >= state.totalRequests && state.totalRequests > 0) {
      process.stdout.write('\n');
    }
  }

  private createProgressBar(percentage: number, width: number): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

/**
 * Formateador detallado con información paso a paso
 */
class DetailedProgressFormatterImpl implements IProgressFormatter {
  format(state: WorkflowState): string {
    const lines = [
      '\n' + '='.repeat(80),
      `📊 ESTADO DEL WORKFLOW`,
      '='.repeat(80),
      `🎯 Paso actual: ${this.formatStep(state.step)}`,
      `📈 Progreso: ${state.completedRequests}/${state.totalRequests} solicitudes`,
      `🖼️  Imágenes capturadas: ${state.imagesCollected}`,
      `🎨 Composiciones creadas: ${state.compositionsCreated}`,
      `⏱️  Tiempo transcurrido: ${this.formatElapsedTime(state.startTime)}`,
      `⏳ Tiempo estimado restante: ${state.eta || 'Calculando...'}`,
    ];

    if (state.currentRequest) {
      lines.push(`🔗 Procesando: ${state.currentRequest}`);
    }

    if (state.errors.length > 0) {
      lines.push(`\n❌ Errores (${state.errors.length}):`);
      state.errors.slice(-3).forEach((error, index) => {
        lines.push(`   ${index + 1}. [${error.step}] ${error.message}`);
      });
    }

    lines.push('='.repeat(80) + '\n');

    return lines.join('\n');
  }

  update(state: WorkflowState): void {
    // Limpiar consola y mostrar nuevo estado
    console.clear();
    console.log(this.format(state));
  }

  private formatStep(step: WorkflowStep): string {
    const stepEmojis: Record<string, string> = {
      setup: '⚙️ Configuración',
      scraping: '🌐 Scraping',
      composition: '🎨 Composición',
      validation: '✅ Validación',
      complete: '🎉 Completado',
      error: '❌ Error',
    };

    return stepEmojis[step] || step;
  }

  private formatElapsedTime(startTime: Date): string {
    const elapsed = Date.now() - startTime.getTime();
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);

    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Gestor de progreso que coordina el tracker y el formateador
 */
export class ProgressManager {
  private tracker: IProgressTracker;
  private formatter: IProgressFormatter;
  private interval: NodeJS.Timeout | null = null;
  private isActive = false;

  constructor(
    tracker: IProgressTracker = new ProgressTracker(),
    formatter: IProgressFormatter = new ConsoleProgressFormatter(),
    private updateInterval: number = 1000
  ) {
    this.tracker = tracker;
    this.formatter = formatter;
  }

  start(initialState?: Partial<WorkflowState>): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;

    if (initialState) {
      this.tracker.updateProgress(initialState);
    }

    this.interval = setInterval(() => {
      const state = this.tracker.getProgress();
      this.formatter.update(state);
    }, this.updateInterval);

    // Primera actualización inmediata
    this.formatter.update(this.tracker.getProgress());
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.isActive = false;

    // Actualización final
    this.formatter.update(this.tracker.getProgress());
  }

  updateProgress(updates: Partial<WorkflowState>): void {
    this.tracker.updateProgress(updates);

    // Actualizar inmediatamente si no hay intervalo activo
    if (!this.isActive) {
      this.formatter.update(this.tracker.getProgress());
    }
  }

  addError(error: string, step?: string, requestId?: string): void {
    this.tracker.addError(error, step, requestId);
  }

  getProgress(): WorkflowState {
    return this.tracker.getProgress();
  }

  reset(): void {
    this.tracker.reset();
    this.formatter.update(this.tracker.getProgress());
  }

  setFormatter(formatter: IProgressFormatter): void {
    this.formatter = formatter;
  }

  setTracker(tracker: IProgressTracker): void {
    this.tracker = tracker;
  }

  isRunning(): boolean {
    return this.isActive;
  }
}

/**
 * Función para crear un progress manager con configuración personalizada
 */
export function createProgressManager(options: {
  tracker?: IProgressTracker;
  formatter?: 'console' | 'detailed' | IProgressFormatter;
  updateInterval?: number;
  interactive?: boolean;
}): ProgressManager {
  const tracker = options.tracker || new ProgressTrackerImpl();

  let formatter: IProgressFormatter;
  if (typeof options.formatter === 'string') {
    switch (options.formatter) {
      case 'detailed':
        formatter = new DetailedProgressFormatterImpl();
        break;
      case 'console':
      default:
        formatter = new ConsoleProgressFormatterImpl();
        break;
    }
  } else {
    formatter = options.formatter || new ConsoleProgressFormatterImpl();
  }

  const updateInterval = options.updateInterval || 1000;

  return new ProgressManager(tracker, formatter, updateInterval);
}

/**
 * Función para manejar múltiples workflows concurrentes
 */
export class MultiWorkflowProgressManager {
  private managers = new Map<string, ProgressManager>();
  private formatter: IProgressFormatter;

  constructor(formatter: IProgressFormatter = new DetailedProgressFormatterImpl()) {
    this.formatter = formatter;
  }

  createWorkflow(id?: string): ProgressManager {
    const workflowId = id || uuidv4();
    const manager = new ProgressManager(
      new ProgressTrackerImpl(),
      this.formatter,
      1000
    );

    this.managers.set(workflowId, manager);
    return manager;
  }

  getWorkflow(id: string): ProgressManager | undefined {
    return this.managers.get(id);
  }

  removeWorkflow(id: string): boolean {
    const manager = this.managers.get(id);
    if (manager) {
      manager.stop();
      return this.managers.delete(id);
    }
    return false;
  }

  getAllWorkflows(): Map<string, ProgressManager> {
    return new Map(this.managers);
  }

  stopAll(): void {
    for (const manager of this.managers.values()) {
      manager.stop();
    }
  }

  getCombinedProgress(): {
    total: number;
    completed: number;
    errors: number;
    workflows: number;
  } {
    let total = 0;
    let completed = 0;
    let errors = 0;

    for (const manager of this.managers.values()) {
      const progress = manager.getProgress();
      total += progress.totalRequests;
      completed += progress.completedRequests;
      errors += progress.errors.length;
    }

    return {
      total,
      completed,
      errors,
      workflows: this.managers.size,
    };
  }
}

// Exportaciones útiles - con alias para evitar conflictos
export const ProgressTracker = ProgressTrackerImpl;
export const ConsoleProgressFormatter = ConsoleProgressFormatterImpl;
export const DetailedProgressFormatter = DetailedProgressFormatterImpl;