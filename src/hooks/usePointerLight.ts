/**
 * Optimización de rendimiento y GPU:
 * Los efectos de iluminación se gestionan de forma nativa por CSS (:hover / :active),
 * evitando recalcular estilos globales del árbol DOM y saturar la GPU con eventos de puntero continuos.
 */
export function usePointerLight(): void {
  // Sin operaciones continuas en el hilo de renderizado
}
