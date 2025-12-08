import { readFile, writeFile } from 'fs/promises';
import { resolve, join } from 'path';
import { parse } from 'yaml';
import { BodegonConfigSchema, BodegonConfig } from '../agents/types.js';

/**
 * Cargador de configuración con soporte para YAML y variables de entorno
 */
export class ConfigLoader {
  private static instance: ConfigLoader;
  private configCache = new Map<string, BodegonConfig>();

  private constructor() {}

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * Carga configuración desde archivo YAML
   */
  async loadConfig(configPath?: string): Promise<BodegonConfig> {
    const finalPath = configPath || this.getDefaultConfigPath();

    // Verificar cache
    if (this.configCache.has(finalPath)) {
      return this.configCache.get(finalPath)!;
    }

    try {
      const configFile = await readFile(finalPath, 'utf-8');
      const yamlConfig = parse(configFile);

      // Aplicar variables de entorno
      const configWithEnvVars = this.applyEnvironmentVariables(yamlConfig);

      // Validar configuración
      const validatedConfig = BodegonConfigSchema.parse(configWithEnvVars);

      // Cache resultado
      this.configCache.set(finalPath, validatedConfig);

      return validatedConfig;
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        throw new Error(`Configuración inválida en ${finalPath}: ${error.message}`);
      }

      throw new Error(`Error al cargar configuración desde ${finalPath}: ${error}`);
    }
  }

  /**
   * Carga configuración para entorno específico
   */
  async loadEnvironmentConfig(environment: 'development' | 'production' = 'development'): Promise<BodegonConfig> {
    const defaultConfig = await this.loadConfig();
    const envConfigPath = this.getEnvironmentConfigPath(environment);

    try {
      const envConfig = await this.loadConfig(envConfigPath);

      // Merge de configuraciones (environment tiene prioridad)
      return this.mergeConfigs(defaultConfig, envConfig);
    } catch (error) {
      console.warn(`⚠️  No se pudo cargar configuración para entorno ${environment}, usando configuración por defecto`);
      return defaultConfig;
    }
  }

  /**
   * Recarga la configuración (limpia cache)
   */
  async reloadConfig(configPath?: string): Promise<BodegonConfig> {
    const finalPath = configPath || this.getDefaultConfigPath();
    this.configCache.delete(finalPath);
    return this.loadConfig(finalPath);
  }

  /**
   * Valida un archivo de configuración sin cargarlo
   */
  async validateConfig(configPath: string): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const configFile = await readFile(configPath, 'utf-8');
      const yamlConfig = parse(configFile);
      const configWithEnvVars = this.applyEnvironmentVariables(yamlConfig);

      BodegonConfigSchema.parse(configWithEnvVars);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        const zodError = error as any;
        return {
          isValid: false,
          errors: zodError.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`)
        };
      }

      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Error desconocido']
      };
    }
  }

  /**
   * Guarda configuración en archivo YAML
   */
  async saveConfig(config: BodegonConfig, configPath?: string): Promise<void> {
    const finalPath = configPath || this.getDefaultConfigPath();

    try {
      const yamlString = this.toYaml(config);
      await writeFile(finalPath, yamlString, 'utf-8');

      // Actualizar cache
      this.configCache.set(finalPath, config);
    } catch (error) {
      throw new Error(`Error al guardar configuración en ${finalPath}: ${error}`);
    }
  }

  /**
   * Obtiene el path del archivo de configuración por defecto
   */
  private getDefaultConfigPath(): string {
    const possiblePaths = [
      join(process.cwd(), 'config', 'default.yaml'),
      join(process.cwd(), 'config', 'default.yml'),
      join(process.cwd(), 'bodegon.config.yaml'),
      join(process.cwd(), 'bodegon.config.yml'),
    ];

    for (const path of possiblePaths) {
      try {
        // En una implementación real, verificaríamos si el archivo existe
        return path;
      } catch {
        continue;
      }
    }

    // Retornar el path por defecto aunque no exista
    return possiblePaths[0];
  }

  /**
   * Obtiene el path de configuración para un entorno específico
   */
  private getEnvironmentConfigPath(environment: string): string {
    return join(process.cwd(), 'config', `${environment}.yaml`);
  }

  /**
   * Aplica variables de entorno a la configuración
   */
  private applyEnvironmentVariables(config: any): any {
    if (!config) return config;

    // Función recursiva para procesar objetos anidados
    const processValue = (value: any): any => {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const envVar = value.slice(2, -1);
        const defaultValue = envVar.includes(':') ? envVar.split(':')[1] : undefined;
        const envName = envVar.includes(':') ? envVar.split(':')[0] : envVar;

        return process.env[envName] || defaultValue || value;
      }

      if (Array.isArray(value)) {
        return value.map(processValue);
      }

      if (typeof value === 'object' && value !== null) {
        const processed: any = {};
        for (const [key, val] of Object.entries(value)) {
          processed[key] = processValue(val);
        }
        return processed;
      }

      return value;
    };

    return processValue(config);
  }

  /**
   * Mergea dos configuraciones (la segunda tiene prioridad)
   */
  private mergeConfigs(base: BodegonConfig, override: BodegonConfig): BodegonConfig {
    const mergeDeep = (target: any, source: any): any => {
      const result = { ...target };

      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = mergeDeep(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }

      return result;
    };

    return mergeDeep(base, override) as BodegonConfig;
  }

  /**
   * Convierte objeto a string YAML (implementación simple)
   */
  private toYaml(obj: any, indent = 0): string {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;

      if (typeof value === 'object' && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        yaml += this.toYaml(value, indent + 1);
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object') {
            yaml += `${spaces}  -\n`;
            yaml += this.toYaml(item, indent + 2).replace(/^  /, '    ');
          } else {
            yaml += `${spaces}  - ${item}\n`;
          }
        }
      } else if (typeof value === 'string') {
        yaml += `${spaces}${key}: "${value}"\n`;
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }

    return yaml;
  }
}

/**
 * Funciones de conveniencia para exportar
 */
export async function loadConfig(configPath?: string): Promise<BodegonConfig> {
  return ConfigLoader.getInstance().loadConfig(configPath);
}

export async function loadEnvironmentConfig(environment?: 'development' | 'production'): Promise<BodegonConfig> {
  return ConfigLoader.getInstance().loadEnvironmentConfig(environment);
}

export async function validateConfigFile(configPath: string): Promise<{ isValid: boolean; errors: string[] }> {
  return ConfigLoader.getInstance().validateConfig(configPath);
}

export async function saveConfigToFile(config: BodegonConfig, configPath?: string): Promise<void> {
  return ConfigLoader.getInstance().saveConfig(config, configPath);
}

// Exportar instancia por defecto
export const configLoader = ConfigLoader.getInstance();