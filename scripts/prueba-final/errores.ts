// El error que el comando convierte en salida 2.
//
// La prueba final sale con 0 si todo pasó, con 1 si alguna comprobación falló y
// con 2 si no llegó a correr: una opción mal escrita, una carpeta que no existe,
// un documento sin los títulos que el fragmento necesita. Es la misma
// convención del verificador, y por el mismo motivo: un 1 dice que algo se midió
// y salió mal, y en estos casos no se midió nada.

export class ErrorDeUso extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeUso';
  }
}
