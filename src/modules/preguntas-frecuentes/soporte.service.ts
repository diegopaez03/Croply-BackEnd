import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const URL_HTTP_REGEX = /^https?:\/\//i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Configuración de "Ayuda y soporte" (Épica 9, decisiones 9 y 10).
 * Se lee una sola vez al arrancar: las variables de entorno no cambian en
 * tiempo de ejecución, y así el `warn` por un valor inválido sale una vez.
 */
@Injectable()
export class SoporteService {
  private readonly logger = new Logger(SoporteService.name);
  private readonly manual_usuario_url: string | null;
  private readonly email_soporte: string | null;

  constructor(config: ConfigService) {
    this.manual_usuario_url = this.leer(
      config,
      'MANUAL_USUARIO_URL',
      URL_HTTP_REGEX,
      'debe empezar con http:// o https://',
    );
    this.email_soporte = this.leer(
      config,
      'SOPORTE_EMAIL',
      EMAIL_REGEX,
      'no tiene formato de correo válido',
    );
  }

  obtener_configuracion() {
    return {
      manual_usuario_url: this.manual_usuario_url,
      email_soporte: this.email_soporte,
    };
  }

  private leer(
    config: ConfigService,
    variable: string,
    formato: RegExp,
    motivo: string,
  ): string | null {
    const valor = config.get<string>(variable)?.trim();
    if (!valor) {
      return null;
    }
    if (!formato.test(valor)) {
      this.logger.warn(`${variable} ignorada: ${motivo}.`);
      return null;
    }
    return valor;
  }
}
