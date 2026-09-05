/**
 * La forma que va a tener la lista, mientras la lista llega.
 *
 * El backend corre con `min-instances=0`: el primer pedido del dia despierta la
 * instancia y puede tardar varios segundos. Una pantalla vacia con un spinner
 * en el medio se lee como colgada; esto adelanta el layout, asi que la espera
 * se siente parte de la carga y no un error.
 *
 * Va aca y no en cada pantalla porque la cava y las catas comparten el mismo
 * rotulo con linea, las mismas filas y el mismo espaciado: dos copias se
 * despegarian a la primera que alguien retoque una.
 */
export function ListaSkeleton({
  aviso,
  grupos = 2,
  filas = 3,
  estante = false,
}: {
  /** Lo que escucha quien usa lector de pantalla, que no ve el esqueleto. */
  aviso: string
  grupos?: number
  filas?: number
  /** La cava cierra cada grupo con la madera del estante; las catas no. */
  estante?: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <span role="status" className="sr-only">
        {aviso}
      </span>

      {Array.from({ length: grupos }, (_, grupo) => (
        // Es decorado: quien no lo ve ya escucho el aviso de arriba.
        <div key={grupo} aria-hidden className="flex flex-col">
          <div className="flex items-center gap-2 pb-[7px]">
            <div className="esqueleto h-[7px] w-[62px]" />
            <div className="h-px grow bg-borde" />
            <div className="esqueleto h-[7px] w-[38px]" />
          </div>

          <div className="flex flex-col gap-[5px]">
            {Array.from({ length: filas }, (_, fila) => (
              <div
                key={fila}
                className="flex items-center gap-[10px] rounded-[7px] border border-borde bg-madera-700 px-[11px] py-2"
              >
                <div className="esqueleto h-[30px] w-[12px] shrink-0" />
                <div className="flex min-w-0 grow flex-col gap-[6px]">
                  <div className="esqueleto h-[6px] w-[38%]" />
                  <div className="esqueleto h-[11px] w-[70%]" />
                  <div className="esqueleto h-[6px] w-[48%]" />
                </div>
                <div className="esqueleto h-[15px] w-[11px] shrink-0" />
              </div>
            ))}
          </div>

          {estante && <div className="esqueleto mt-[7px] h-[3px] w-full rounded-sm" />}
        </div>
      ))}
    </div>
  )
}
