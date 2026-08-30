/**
 * Achicar la foto de la etiqueta antes de subirla.
 *
 * Una foto de telefono son ~2,5 MB y 12 megapixeles. Se guardaba tal cual, y
 * despues se mostraba en un recuadro de 92x132. Achicarla en el cliente ahorra
 * red, bucket y espera, sin que se note en pantalla.
 *
 * De regalo, `createImageBitmap` con `imageOrientation: 'from-image'` aplica la
 * orientacion EXIF y el JPEG resultante sale sin metadatos: una foto sacada en
 * casa ya no viaja con su geolocalizacion.
 */

/** Al escaneo va la version grande: son los pixeles con los que Gemini lee. */
export const PRESET_OCR = { maxEdge: 2048, quality: 0.9 }

/** A la cava, la de mostrar: alcanza de sobra para el visor a pantalla completa. */
export const PRESET_GUARDAR = { maxEdge: 1280, quality: 0.82 }

/** Cuanto hay que escalar para entrar en `maxEdge`. Nunca agranda. */
export function escala(ancho: number, alto: number, maxEdge: number): number {
  const mayor = Math.max(ancho, alto)
  if (mayor <= 0) return 1
  return Math.min(1, maxEdge / mayor)
}

export async function prepareLabelPhoto(
  file: File,
  { maxEdge, quality }: { maxEdge: number; quality: number },
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const factor = escala(bitmap.width, bitmap.height, maxEdge)
    const ancho = Math.round(bitmap.width * factor)
    const alto = Math.round(bitmap.height * factor)

    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(bitmap, 0, 0, ancho, alto)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    if (!blob) return file

    // Si comprimir no achico nada (una foto ya chica), no vale la pena perder
    // el original a cambio de otro pase de JPEG.
    if (blob.size >= file.size) return file

    return new File([blob], 'etiqueta.jpg', { type: 'image/jpeg' })
  } catch {
    // Un HEIC de iPhone no se decodifica en canvas. Subir el original es peor
    // que comprimirlo, pero muchisimo mejor que no poder cargar el vino.
    return file
  }
}
