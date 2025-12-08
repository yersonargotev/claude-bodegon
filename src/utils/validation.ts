import type { IUrlValidator, ProcessingRequest, BodegonConfig } from '../agents/types.js';

/**
 * Implementación del validador de URLs
 */
export class UrlValidator implements IUrlValidator {
  private readonly urlPattern: RegExp;
  private readonly allowedSchemes = ['http', 'https'];

  constructor() {
    this.urlPattern = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;
  }

  isValidUrl(url: string): boolean {
    try {
      // Validar formato básico
      if (!this.urlPattern.test(url)) {
        return false;
      }

      const parsedUrl = new URL(url);

      // Validar esquema
      if (!this.allowedSchemes.includes(parsedUrl.protocol.replace(':', ''))) {
        return false;
      }

      // Validar que tenga un dominio válido
      if (!parsedUrl.hostname) {
        return false;
      }

      // Validar que el dominio no sea localhost
      if (this.isLocalhost(parsedUrl.hostname)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  isAllowedDomain(url: string, allowedDomains: string[]): boolean {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();

      return allowedDomains.some(domain => {
        const domainLower = domain.toLowerCase();

        // Coincidencia exacta
        if (hostname === domainLower) {
          return true;
        }

        // Subdominios (ej: store.example.com para example.com)
        if (hostname.endsWith(`.${domainLower}`)) {
          return true;
        }

        // Wildcards
        if (domainLower.startsWith('*.')) {
          const baseDomain = domainLower.slice(2);
          return hostname.endsWith(`.${baseDomain}`) || hostname === baseDomain;
        }

        return false;
      });
    } catch {
      return false;
    }
  }

  sanitizeUrl(url: string): string {
    try {
      // Eliminar espacios en blanco
      url = url.trim();

      // Agregar https si no tiene protocolo
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }

      // Validar y construir URL
      const parsedUrl = new URL(url);
      return parsedUrl.toString();
    } catch {
      throw new Error(`URL inválida: ${url}`);
    }
  }

  extractDomain(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname;
    } catch {
      return '';
    }
  }

  private isLocalhost(hostname: string): boolean {
    const localhostPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
    ];

    return localhostPatterns.includes(hostname) ||
           hostname.startsWith('192.168.') ||
           hostname.startsWith('10.') ||
           hostname.startsWith('172.');
  }
}

/**
 * Validador para solicitudes de procesamiento
 */
export class ProcessingRequestValidator {
  private urlValidator: UrlValidator;

  constructor() {
    this.urlValidator = new UrlValidator();
  }

  validate(request: ProcessingRequest, config: BodegonConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validar URL
    if (!this.urlValidator.isValidUrl(request.url)) {
      errors.push('URL inválida o no accesible');
    } else if (!this.urlValidator.isAllowedDomain(request.url, config.scraping.allowedDomains)) {
      errors.push(`Dominio no permitido. Dominios permitidos: ${config.scraping.allowedDomains.join(', ')}`);
    }

    // Validar prompt
    if (!request.prompt || request.prompt.trim().length < 10) {
      errors.push('El prompt debe tener al menos 10 caracteres');
    }

    if (request.prompt.length > 1000) {
      errors.push('El prompt es demasiado largo (máximo 1000 caracteres)');
    }

    // Validar configuración personalizada
    if (request.customSettings) {
      if (request.customSettings.maxImages && (request.customSettings.maxImages < 1 || request.customSettings.maxImages > 10)) {
        errors.push('El número máximo de imágenes debe estar entre 1 y 10');
      }

      if (request.customSettings.outputDirectory && !this.isValidPath(request.customSettings.outputDirectory)) {
        errors.push('Directorio de salida inválido');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private isValidPath(path: string): boolean {
    // Validar que no contenga caracteres peligrosos
    const dangerousPatterns = [
      /\.\./,  // Directory traversal
      /[<>:"|?*]/,  // Caracteres inválidos en Windows
      /^[/\\]/,  // Path absoluto
    ];

    return !dangerousPatterns.some(pattern => pattern.test(path));
  }
}

/**
 * Validador de configuración
 */
export class ConfigValidator {
  validate(config: Partial<BodegonConfig>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar configuración del agente
    if (config.agent) {
      if (config.agent.maxConcurrentJobs && config.agent.maxConcurrentJobs < 1) {
        errors.push('maxConcurrentJobs debe ser al menos 1');
      }

      if (config.agent.maxConcurrentJobs && config.agent.maxConcurrentJobs > 20) {
        warnings.push('maxConcurrentJobs mayor a 20 puede causar problemas de rendimiento');
      }

      if (config.agent.defaultTimeout && config.agent.defaultTimeout < 30000) {
        warnings.push('defaultTimeout menor a 30 segundos puede ser insuficiente para operaciones complejas');
      }
    }

    // Validar configuración de scraping
    if (config.scraping) {
      if (config.scraping.maxImages && (config.scraping.maxImages < 1 || config.scraping.maxImages > 20)) {
        errors.push('maxImages debe estar entre 1 y 20');
      }

      if (config.scraping.allowedDomains && config.scraping.allowedDomains.length === 0) {
        warnings.push('No hay dominios permitidos configurados');
      }

      if (config.scraping.browserConfig?.timeout && config.scraping.browserConfig.timeout < 5000) {
        warnings.push('Timeout de navegador muy bajo puede causar fallos en conexiones lentas');
      }
    }

    // Validar configuración de retry
    if (config.retry) {
      if (config.retry.maxAttempts && config.retry.maxAttempts < 1) {
        errors.push('maxAttempts debe ser al menos 1');
      }

      if (config.retry.maxAttempts && config.retry.maxAttempts > 10) {
        warnings.push('maxAttempts mayor a 10 puede hacer las operaciones muy lentas');
      }

      if (config.retry.baseDelay && config.retry.baseDelay < 500) {
        warnings.push('baseDelay muy bajo puede sobrecargar el servidor');
      }
    }

    // Validar directorios de salida
    const checkDirectory = (path: string, name: string) => {
      if (path && (path.includes('..') || path.startsWith('/') || path.startsWith('C:'))) {
        warnings.push(`${name} usa path absoluto o potencialmente inseguro`);
      }
    };

    if (config.composition?.outputDirectory) {
      checkDirectory(config.composition.outputDirectory, 'outputDirectory');
    }

    if (config.logging?.file) {
      checkDirectory(config.logging.file, 'log file');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * Funciones de utilidad para validación
 */
export const ValidationHelpers = {
  /**
   * Validar que un string no esté vacío o solo contenga espacios
   */
  isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  },

  /**
   * Validar que un número esté en un rango
   */
  isInRange(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && value >= min && value <= max;
  },

  /**
   * Validar que un valor sea uno de los permitidos
   */
  isOneOf<T>(value: unknown, allowed: T[]): value is T {
    return allowed.includes(value as T);
  },

  /**
   * Validar que un path sea relativo y seguro
   */
  isSecurePath(path: string): boolean {
    return !path.includes('..') &&
           !path.startsWith('/') &&
           !path.match(/^[a-zA-Z]:/);
  },

  /**
   * Validar formato de email
   */
  isValidEmail(email: string): boolean {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  },

  /**
   * Validar que un string sea un JSON válido
   */
  isValidJson(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Sanitizar string para prevenir injection
   */
  sanitizeString(str: string): string {
    return str
      .replace(/[<>]/g, '') // Remover caracteres potencialmente peligrosos
      .trim()
      .substring(0, 1000); // Limitar longitud
  }
};

/**
 * Función para crear un validador de URLs con configuración personalizada
 */
export function createUrlValidator(_options: {
  allowedSchemes?: string[];
  blockLocalhost?: boolean;
  blockPrivateIPs?: boolean;
} = {}): UrlValidator {
  return new UrlValidator();
}

// Exportaciones por defecto
export const urlValidator = new UrlValidator();
export const requestValidator = new ProcessingRequestValidator();
export const configValidator = new ConfigValidator();