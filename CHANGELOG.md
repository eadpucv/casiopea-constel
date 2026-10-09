# Changelog — Casiopea-Con§tel

## 0.18.1 — 2026-10-09

- **Botón destructivo de la piel**: «Fusionar», «Borrar» y «Guardar y borrar»
  usan el relleno de peligro de Stella Nova (`--sn-btn-danger-bg` y `-fg`, con
  alias nuevos `--constel-btn-danger-*`) en vez de una variante propia de fondo
  neutro con texto rojo. Un botón junto a su campo (`.constel-add`) mide lo
  mismo que el campo.

- **Controles del mapa en pantallas chicas** (hasta 40 rem): el texto «con§tel»
  pliega y despliega los controles (parten plegados; se recuerda si el lector
  los abre); los
  deslizadores van a todo el ancho; los íconos de navegación (acercar, alejar,
  encuadrar, exportar, copiar) se reparten por todo el ancho en su propia línea, con aire
  hacia los bordes.
- El texto «con§tel» de la barra es un 11 % más grande (0,966 rem) y deja la
  mitad de aire a su derecha, en todos los tamaños.

## 0.18.0 — 2026-10-09

- **Borrar en la ventana del §**: una papelera tenue (Lucide `trash`) en la
  esquina inferior izquierda, que se pone colorada al apuntarla; reemplaza el
  botón de texto y también está en el formulario del § propio (Guardar sigue a
  la derecha). La confirmación en línea no cambia. El panel lateral del mapa
  lleva la misma papelera bajo cada § (autor y moderadores), así que el borrar es
  igual en la lectura y en el mapa.

- **Los enlaces de concepto nunca abren «Todos»**: llevan a
  `Especial:Constelación?concept=Nombre&users=Autor`, con las secciones de quien
  anotó (con ~20.000 notas, «Todos» carga el corpus entero). `?users=A;B` es
  nuevo en el mapa; sin él, abre con los de quien mira.

- **Hilo entre la ventana y el texto**: la ventana flotante de un § (y la del
  formulario de anotar) se une al texto al que se refiere con una recta fina y un
  punto en el borde del texto: horizontal si la ventana está al lado, vertical si
  está debajo o encima. Sigue a la ventana al arrastrarla o redimensionarla y al
  texto al desplazar o reflujar (`connect()` en `ext.constel.ui/panel.js`).

- **Conceptos como enlaces**: en la ventana de un § en el texto y en las
  píldoras de los temas del panel lateral del mapa, cada concepto es un enlace a
  `Especial:Constelación?concept=Nombre` (clic derecho, Ctrl+clic, pestaña
  nueva). En el panel lateral, el clic simple sigue eligiéndolo en el mismo mapa.
  Módulo nuevo `ext.constel.ui/links.js`.

- **Minimapa de la lectura**: con la ventana de un § abierta (clic en su marca
  en el texto), su trazo del minimapa se yergue (como al pasar el puntero) y
  vuelve a su tamaño al cerrarla. `minimap.setActive()`, `panel.open` acepta
  `onClose`.

- **Panel de referencias como árbol**: líneas dibujadas (│ ├ └) unen la página,
  sus §§ y los conceptos de cada §; los conceptos son enlaces reales al mapa
  (`?concept=`), con clic derecho y pestaña nueva.

- **Volver al mapa**: un concepto del panel de referencias de una incrustación
  lleva a `Especial:Constelación?concept=Nombre` (concepto elegido, secciones de
  todos los lectores, encuadre de la escena completa). A pantalla completa lo
  elige sin navegar.
- **Elegir un concepto ya no mueve la cámara**: antes lo llevaba al centro y
  reiniciaba el desplazamiento, aunque el contexto no cupiera. Ahora el zoom,
  el desplazamiento y el centro quedan como estaban (el mapa entero es el marco);
  tampoco lo mueve cambiar una fuerza de proximidad.
- **iOS y móviles**: sin fondos desenfocados ni animaciones; los textos de los
  conceptos van del color del tema (`ext.constel.ui/device.js`, `view.calm`).
- **Panel flotante de referencias** (`refpanel.js`) en el mapa a pantalla
  completa y en `{{#constel:}}`: páginas del concepto, sus §§ (40 caracteres y
  puntos suspensivos) y los demás conceptos de cada §; se arrastra y
  redimensiona dentro del marco.

- **Parser function `{{#constel: …}}`** (también `{{#con§tel: …}}`): inserta
  en cualquier página el mapa de conceptos **limpio**, sin controles ni panel.
  Parámetros opcionales, todos con valor por omisión: `usuario`, `concepto`
  (foco), `modo` (2d/3d), `girar`, `aristas`, `conceptos` (palabras/nodos),
  `paginas`, `alto`, `fuerza-seccion`, `fuerza-traslape`, `fuerza-pagina`,
  `fuerza-tema` y `class`. Cacheable (no depende de quién mira), de sólo
  lectura, y admite varios mapas por página. Módulo nuevo `ext.constel.embed`,
  hook `ParserHooks`, palabra mágica en `casiopea-constel.magic.php`.
- **`class=full-width` / `ancho-completo`** en el mapa embebido lo lleva a
  sangre y sin esquinas redondeadas (regla en Stella Nova).
- **Mis anotaciones** entra directo a los filtros: se retira el texto
  introductorio (`myconstel-summary`).
- `map.js` ya no falla si la página no trae la config de `Especial:Constelación`
  (`wgConstelMap`), para poder reusarse desde `ext.constel.embed`.
- **Documentación**: README, `docs/MAPA.md` (sección 15), `docs/ARCHITECTURE.md`
  y la spec; manual de lectores en la wiki («Manual de con§tel»).

## 0.17.0 — 2026-10-07

- **Vista del concepto renovada.** El título lleva `[a]`, el concepto y el
  ícono de anillos en la misma línea, al tamaño del texto. Debajo, una fila:
  «n secciones · n páginas · Pertenece al tema [tema ×]», o «Sin tema
  asociado» con un botón «asociar» (del tema Stella Nova) que se vuelve un
  campo con autocompletado de los temas propios. La × saca el concepto de su
  tema. Desaparece el select «Agregar al tema» del pie del panel.
- **«Temas» con ícono.** En la vista de partida, «Mis temas» pasa a
  ícono (el del deslizador de tema) + «Temas».
- **Se retira «Ver como lista»** de todas las vistas, junto con su
  alternativa textual (`AccessibleAlternative`, retirada en la spec).
- **Vista de nodos encuadrada.** Sin rótulos el encuadre ya no se limita a
  zoom 1: el mapa se amplía hasta llenar el lienzo.
- **Retoques de color.** Fondo del tema con menos desenfoque (`blur(0.9ex)`),
  halo del texto de 2,5 px y aristas en un tono más suave que
  `--constel-ink-faint` (mezcla con `--constel-hairline`).

## 0.16.0 — 2026-10-06

- **El tema, de fondo del rótulo.** Con los conceptos como palabras (2D y 3D),
  todos los rótulos llevan el color del texto y el color del tema va en una
  caja del tamaño exacto de la tinta, muy desenfocada (`blur(2.25ex)`, que
  escala con la letra), detrás de cada concepto que pertenece a un tema (en
  3D se aleja y atenúa con la niebla). Con círculos, nada cambia: el círculo
  lleva el color. `?wash=0` en la URL vuelve al esquema anterior. El SVG
  exportado conserva el esquema anterior (texto de color del tema, sin
  fondo), porque el filtro CSS no viaja dentro de un SVG suelto.
- **Halo del texto más fino y translúcido.** El contorno claro de los
  rótulos pasa de 3 px opaco a 2 px al 50 % (también en el SVG exportado, que
  ahora copia la opacidad del trazo). Los círculos conservan el suyo.
- **Vista de anillos sin la lista «Vecinos de X por anillo».** Colgaba bajo el
  mapa, que no tiene scroll, así que no se podía ver ni usar. Se van con ella
  el «+N más» y sus mensajes; la leyenda de anillos se queda. Los vecinos
  fuera del cupo de cada anillo (8, 16 y 24) se alcanzan eligiendo otro
  centro. Se actualizan la spec (`RingsView`) y `docs/MAPA.md`.

## 0.15.0 — 2026-10-06

- **Vista de partida del mapa, y se recuerda lo que el lector ajusta.** Quien
  aún no ha tocado nada ve 2D, aristas visibles, conceptos como palabras, los
  cuatro deslizadores al 25 % (antes 100/60/35/50) y todo encuadrado. Desde
  que ajusta, el mapa recuerda por navegador sus últimos ajustes: la vista
  2D/3D y las aristas (nuevos), además de palabras/nodos, fuerzas y «girar
  solo» (que ya se recordaban). Con varios lectores filtrados se mantiene la
  regla de partir con el traslape al 100 % y el mismo texto en 0 %
  (`OverlapFirstForSeveralReaders`), salvo que ya haya fuerzas guardadas.

- **Enlace a la sección, en negrita; y la nota, más legible.** En el panel del
  mapa y en Mis anotaciones, el enlace a la página de cada sección va al § mismo
  (`Página#constel-N`) y no a la página en general: la lectura sobre la página
  (`reader/init.js`) se desplaza a su marca, la resalta un momento y, si la
  lectura no la dibujaba (marcas ocultas, o es de otro lector y se ven sólo las
  propias), la muestra. El enlace sale en negrita (600). Las secciones perdidas
  conservan el enlace a la versión donde eran válidas. La nota bajo el pasaje
  tiene más margen superior (12 px), un cuerpo algo mayor (entre xs y sm) y
  sangría a la izquierda (16 px).

- **Secciones sin filete ni sangría** en el panel del mapa y en Mis
  anotaciones: el pasaje y su glosa van al ras, sin el borde de color a la
  izquierda ni su padding. Las perdidas y congeladas ya no se distinguen por el
  estilo del borde (punteado), sino por su aviso. La lectura sobre la página
  no cambia.

- **Mis anotaciones: orden de columnas.** Selección, página, sección (con su
  glosa), conceptos y creación.

- **Mis anotaciones: columnas.** La de casillas pasa de ~99 a ~29 px (el skin
  impone `min-width: 7em` a las celdas de tablas wiki; se anula con mayor
  especificidad) y «Conceptos» tiene un mínimo de `11rem`, así que toma lo que
  la primera libera y la mayoría de los conceptos de dos palabras caben en una
  línea.

- **Mis anotaciones: píldoras de concepto ajustadas.** Un concepto de varias
  palabras que se parte en líneas ocupaba todo el ancho de la celda aunque el
  texto no lo llenara. Ahora la píldora mide lo que su línea más larga
  (`fitChips` en `mine.js`, que se recalcula al redimensionar; sin JS vuelve al
  ancho de la celda) y la esquina es proporcional al texto (`0.9em`, antes
  `pill` = 999px, que redondeaba sin medida cuando había varias líneas).

- **Mis anotaciones: selección y acciones por lote.** Casilla por fila y una
  en la cabecera para toda la página (con estado intermedio). Con filas
  marcadas aparece, a continuación de «Resultados», el selector «Acciones por
  lote» (sin rótulo aparte: su primera opción lo nombra) con una sola acción,
  Eliminar, y el conteo de seleccionadas. Eliminar, en lote o por fila, pide
  confirmación en un modal centrado (`<dialog>`, el mismo estilo del de
  fusionar conceptos); el lote borra de a una (la API borra un § por llamada)
  y se detiene en el primer error.

- **Mis anotaciones: orden, paginación y acciones por fila.** El orden es
  filtros → fila de acciones (selector «Resultados» 20/50/100, con 20 por
  omisión, luego exportación y «Ver la constelación») → tabla → paginación,
  que ya no se repite arriba. La paginación es propia (antes los botones OOUI
  azules del núcleo): texto xs sin negritas, flechas Lucide del tamaño del
  texto y enlaces activos con el color de enlace. En la columna «Creado» van
  «Editar» (`square-pen`) y «Eliminar» (`trash`) como íconos con tooltip;
  Eliminar ahora está en todas las filas (antes sólo en las congeladas). El
  selector se llama «Resultados»; la columna, «Creación», con la fecha en
  cursiva y los íconos a continuación.

- **Mis anotaciones: el filtro por concepto es tolerante.** Exigía el nombre
  exacto (salvo la primera mayúscula): «travesia» o «oficio» daban una tabla
  vacía. Ahora ignora mayúsculas y tildes y, si no hay un concepto con ese
  nombre, acepta el comienzo («Trav» → todos los que empiezan así). También
  vale para la exportación CSV.

- **Mis anotaciones: se retira la columna «Estado» y el ZIP se vuelve CSV.**
  «Estado» casi siempre decía «Anclada»; lo que importa (perdida, congelada) ya
  tenía señal propia en la fila, y ahora «perdida» también la tiene dentro de la
  celda de la sección. El filtro por estado se conserva. El botón «Exportar
  (ZIP para con§tel)» no tenía a dónde importarse: ahora es «Exportar CSV» (con
  filtros activos: «Exportar esta tabla» y «Exportar todo»). Columnas: sección,
  glosa, página, conceptos, estado, creado; UTF-8 con BOM, y las celdas que
  parecen fórmula se neutralizan. `ExportBuilder` (ZIP) queda sin uso desde la
  interfaz.

- **El desarrollo de un tema se guarda solo.** Se retira el botón «Guardar
  desarrollo»: se guarda 1,2 s después de dejar de escribir y al salir del
  cuadro, con una línea de estado («Guardando…», «Guardado»). No redibuja el
  panel, así que no se pierde el foco. El alto del cuadro (que se estira desde
  la esquina) se recuerda por navegador y vale para todos los temas.

- **Un concepto soltado vuelve a la simulación.** Antes, al soltarlo en 2D
  quedaba fijado (`node.pin`) y fuera de las fuerzas; ahora queda libre, con su
  lugar de soltado como equilibrio.

- **Cuarto deslizador: tema** (ícono `book-type`). Los conceptos del mismo tema
  (mismo color) se agrupan como conjunto, con fuerza propia de 0 a 100 % (50 %
  por omisión; antes era una atracción fija y muy débil al centro del tema).
  Además de atraer al centro, repele más a los conceptos de otros temas y
  debilita las aristas que cruzan temas, para que los conjuntos queden con
  borde. No es un grado de proximidad: no dibuja aristas. Se recuerda por
  navegador junto con las otras fuerzas.

## 0.14.0 — 2026-09-30

- **Ícono de «misma sección».** El primer deslizador de proximidad usa el ícono
  `section` (§) de Lucide, en lugar de `text-align-start`.
- **Se retira «Rotular los principales».** La casilla de la estrella resultaba
  confusa: con nodos, el rótulo se lee al apuntar cada círculo. Se eliminan la
  casilla, la preferencia `lead`, el ícono `star` y la opción
  `$wgConstelMapMainLabels`.
- **Niebla 3D más suave.** Lo más lejano baja a 35 % de opacidad (antes 8 %) y
  la curva es lineal (antes cuadrática), así los textos del fondo siguen
  legibles.
- **Anillos con leyenda.** Bajo la barra, una leyenda numera los anillos de
  adentro hacia afuera con su nombre, y uno sin vecinos lo dice («2. Traslape:
  sin vecinos (pide lectores distintos)»), para que el traslape vacío con un
  solo lector no parezca un fallo.

## 0.13.0 — 2026-09-30

- **«Todos» como un lector más.** Se elimina el interruptor del filtro
  «Secciones de»: ahora se escribe «Todos» en la caja y se elige del
  autocompletado, donde lleva un ícono de globo que lo distingue de los
  usuarios (y en su píldora). Reemplaza a los demás lectores, y agregar a uno
  lo saca. El visitante anónimo parte en «Todos».

- **Letra y círculos más chicos.** Los rótulos miden de 11 a 22 px al
  encuadre y hasta 24 px con zoom (antes 13 a 33 y hasta 40); los círculos, de 2,4 a 10 px de radio (antes 3 a 15,6). El mapa
  pesa menos frente al texto de la página.

## 0.12.0 — 2026-09-30

- **Color de los temas.** Un círculo de color antes del nombre de cada tema
  abre el selector de color. El elegido pinta el título, el texto y el círculo
  de sus conceptos, en el mapa y en los anillos, y se recuerda por navegador.
- **Texto 3D más chico.** La perspectiva agranda la letra a la raíz de lo que
  agranda la caja, y el texto cercano deja de verse desmedido frente al 2D.
- **SVG con halo.** El SVG exportado conserva el contorno de contraste de los
  textos y su negrita.
- **Desplegables por delante.** El desplegable del filtro de páginas queda
  sobre el botón de pantalla completa, y el layout del mapa aísla sus capas.

## 0.11.0 — 2026-09-30

- **Aristas visibles con nodos.** Con el interruptor «Aristas» encendido se
  dibujan también en modo Nodos, siempre debajo de los nodos; con más que el
  tope se dibujan las más fuertes y las del concepto apuntado o elegido, en vez
  de ninguna. Se eliminó la leyenda de lectores, cuyo margen dejaba un hueco
  entre los controles y el mapa, y los avisos pasaron a flotar sobre el mapa.
- **Menos aire entre nodos.** Dos círculos chocan como círculos, con el mismo
  margen que hay entre dos cajas de texto, y no como cuadrados (que en la
  diagonal dejaban más espacio). Con los 1 006 conceptos de la prueba de carga,
  el hueco mediano entre círculos vecinos baja de 3,4 a 2,5 px.
- **Círculos 40 % más chicos.** El radio de los nodos baja de 5 a 26 px a 3 a
  15,6 px al zoom de encuadre, y el de los círculos de la vista de anillos en
  la misma proporción.
- **Barra del mapa reorganizada.** La primera fila dice cómo se ve (vista
  2D/3D, girar solo, aristas, conceptos como palabras o nodos, proximidad y
  zoom) y la segunda qué se ve (lectores, páginas, lente y, con varios
  lectores, qué conceptos). Aristas, palabras ⇄ nodos y girar solo son
  interruptores o casillas, nombrados con íconos. La letra mínima sube de 11
  a 13 px (los rótulos miden de 13 a 33).
- **Volver como texto con flecha.** «← Temas» (del panel) y «← Mapa» (de los
  anillos) pasan de botones a texto discreto con su flecha, y en el panel quedan
  alineados con el ícono de los anillos en la misma línea.
- **Texto de carga al centro.** Mientras se lee el mapa, el lienzo dice «Leyendo
  conceptos y calculando distancias» en el centro, latiendo levemente (quieto con
  `prefers-reduced-motion`), y un cambio de vista sobre un mapa grande lo muestra
  antes de calcular.
- **Aristas resaltadas más tenues en conceptos muy conectados.** Con cientos de
  vecinos, las aristas del concepto apuntado o elegido bajan su opacidad (de 1
  a 0,12) para no inundar el mapa.
- **2D ⇄ 3D como interruptor.** El selector de vista pasa a ser un interruptor
  con un ícono a cada lado (`square`, la vista plana, y `box`, el espacio),
  igual que palabras ⇄ nodos; «Girar solo» aparece sólo en 3D.
- **Tooltip explicativo en todos los íconos.** Cada ícono de la interfaz del mapa
  explica qué hace su control (por ejemplo, el de traslape dice cuánto atrae a
  conceptos de lectores distintos que comparten texto), incluidos los de las
  píldoras de lectores, páginas y lente, el de fusionar y el de los anillos. Se
  comprobó en el navegador que ningún ícono quede sin nombre.
- **Anillos con ícono.** El botón «Ver anillos» del panel, pegado a «Temas», pasa
  a ser un ícono `disc-2` (círculos concéntricos; `circle-dot` ya significa
  «Nodos» en la barra).
- **Íconos Lucide.** Los íconos de la extensión pasan de Feather a Lucide
  (`ext.constel.ui/icons.js`, desde `lucide-static` 1.49): aristas
  (`waypoints`), palabras (`type`), nodos (`circle-dot`), rotular los
  principales (`star`) y girar solo (`rotate-3d`) se nombran con su ícono, con
  el texto como tooltip y nombre accesible.
- **Vista por omisión: 2D con palabras.** El mapa ya no parte como nodos con
  más de 80 conceptos; los topes de carga lo protegen.
- **Letra coherente en 2D y 3D, y el zoom la escala.** Antes el 2D escalaba la
  letra con el zoom de encuadre (aplastada contra el piso de 13 px en mapas
  densos) y el 3D partía sin encuadre, así que salía más grande; además
  acercar no la cambiaba, porque crecía desde un tamaño bajo el piso. Ahora el
  3D se encuadra como el 2D y el zoom escala la letra desde lo que se ve,
  entre 13 y 40 px.
- **Concepto enfocado en negrita, en 2D y 3D.** El concepto elegido se destaca
  con un peso mayor en ambas vistas, y deja de subrayarse.
- **Conceptos como palabras o nodos.** Un interruptor explícito deja el mapa
  en palabras o en nodos, y una casilla «Rotular los principales», apagada por
  omisión, deja la palabra de los conceptos de mayor frecuencia
  (`$wgConstelMapMainLabels`, 12, y a lo más la cuarta parte del mapa). Como
  nodo, un concepto es un
  círculo con el color de su tema y área proporcional a su frecuencia; al
  apuntarlo se lee su rótulo encima y sus vecinos quedan resaltados, y en
  un dispositivo que no puede apuntar el primer toque revela y el segundo
  elige; con mouse un clic elige. Sin rótulos o con los
  principales. En 2D las
  cajas de choque de los círculos son más chicas y el mapa se compacta: con
  los 1 006 conceptos de la prueba de carga, la extensión baja de 2 617 a 931
  y la proporción alto/ancho de 1,75 a 0,84.
- **Topes de carga del mapa.** Pensado para lecturas colectivas muy grandes,
  cada costo tiene un tope configurable y un aviso que flota sobre el mapa cuando
  actúa (se cierra con su botón y se apaga solo):
  la respuesta trae a lo más 2 000 conceptos (los más frecuentes,
  `$wgConstelMapMaxNodes`), «todos los rótulos» dibuja a lo más 300
  (`$wgConstelMapMaxLabels`), con más de 6 000 aristas se dibujan las más fuertes y
  las del concepto apuntado o elegido (`$wgConstelMapMaxDrawnLinks`) y el filtro de
  lectores admite 8. El layout de fuerzas hace menos iteraciones con muchos
  conceptos y el choque de cajas compara sólo las que se cruzan en x. Con los
  1 006 conceptos de la prueba de carga, redibujar con todos los rótulos pasa
  de más de 15 s a unos 3 s.
- **Lectura entre varios lectores.** Con dos o más lectores en «Secciones de»,
  cada concepto muestra quién lo aporta: su texto (o su círculo) se pinta con
  el color del lector, en tramos proporcionales si lo aportan varios, y cada
  píldora de lector lleva un círculo de color que abre un selector para
  cambiarlo. Un selector Todos ·
  Compartidos · Propios, en la fila de filtros, deja ver sólo los conceptos
  que comparten dos o más lectores o los de uno solo, y el mapa parte con el traslape al 100 % y el mismo texto en
  0 % (salvo que ya se hayan guardado las fuerzas). `list=constelgraph`
  entrega `readers` por nodo sin nombrar a los usuarios ocultos.
- **Vista de anillos.** Con un concepto elegido, «Ver anillos» lo pone al
  centro y ordena a sus vecinos en tres anillos, uno por grado de proximidad
  (misma sección, traslape, mismo texto), cada uno con su cupo de 8, 16 y 24
  y un «+N más» que abre el resto. Dentro de cada anillo quedan contiguos los
  vecinos próximos entre sí. Elegir un vecino lo desliza al centro, «Volver al
  mapa» conserva la selección, y la lista de vecinos por anillo es la
  alternativa textual.
- **Mapa 3D más abierto y con niebla.** La esfera del layout crece con la
  cantidad de conceptos, su escala la fija el percentil 92 de las distancias
  y los conceptos lejanos se atenúan con niebla en profundidad, así que los
  rótulos del frente no compiten con los del fondo.
- **El grafo del mapa se calcula una vez y se guarda.** `GraphBuilder` guarda
  su resultado en `WANObjectCache`, con una clave por conjunto de lectores, de
  páginas y de grados pedidos, y lo descarta cuando una escritura cambia lo que
  el mapa dibuja (crear, codificar, descodificar o borrar un §, perderlo,
  congelarlo, re-anclarlo, renombrar o fusionar un concepto). La marca de
  aporte de quien mira se calcula aparte. `$wgConstelGraphCache` permite
  dedicar al grafo otro tipo de caché; por omisión usa la principal.
- **`list=constelgraph` entrega menos.** El parámetro `cgkinds` pide sólo
  algunos grados de arista y `cgcompact` empaqueta las aristas por grado en
  una cadena de enteros: con los 20 000 § de la prueba de carga, el grafo
  completo pasa de 6,9 MB a 0,8 MB. El mapa pide sólo los grados con fuerza
  mayor que cero y, si una fuerza sube desde 0, pide y suma los que faltan sin
  redibujar.
- **Menos tiempo de servidor.** El bucle de pares de `co_page` usa claves con
  una base cercana a los ids de concepto (con una potencia de dos, la tabla
  hash de PHP colisionaba) y la respuesta empaquetada evita que `ApiResult`
  recorra cada arista: el grafo completo sin caché baja de 1 173 ms a unos
  280 ms, y con caché a unos 55 ms.
- **Especial:Constelación arma su lista sin el grafo.** La lista de conceptos
  con frecuencias sale de un conteo por concepto (`conceptCounts`, también
  en caché) y el servidor deja de calcular el grafo que el cliente vuelve a
  pedir. El mensaje de frecuencias, con `PLURAL`, se formatea una vez por cada
  par distinto de §§ y páginas: la página completa pasa de 525 ms a 162 ms con
  los 20 000 § de la prueba de carga.
- **Traslapes con tope.** `$wgConstelOverlapMaxPerPage` (por omisión 0, sin
  tope) limita los §§ anclados que cuentan por página en el cálculo de
  traslape.
- **Autores y lectores en lote.** `list=constelexcerpts` de una página con 13
  autores hacía 67 consultas: cada autor pedía su actor, su usuario y sus
  bloqueos por separado. Ahora `AuthorFormatter` carga los autores de la
  respuesta de una vez, y `ReaderDirectory` resuelve a todos los lectores con
  cuatro consultas cada vez que se escribe en el buscador. Los usuarios
  ocultos siguen enmascarados igual.
- **Límite de frecuencia en las escrituras.** Crear y modificar la lectura
  propia cuenta contra `RateLimits['constel-annotate']`, con 60 acciones por
  minuto por usuario y 30 por cuenta nueva por omisión. Los bots y
  administradores (`noratelimit`) quedan fuera, y borrar lo propio nunca
  cuenta. Crear, codificar y glosar ya pasaban por la comprobación de página
  del core, que ahora aplica el límite; los temas, membresías y desarrollos lo
  cuentan con `limitRate()`.

## 0.10.0 — 2026-09-25

- **Minimap de secciones en la página.** Un trazo vertical fijo al borde
  izquierdo, de la cabecera al pie de la ventana, representa el texto entero;
  cada § visible es un trazo horizontal a su altura proporcional, del color
  de su marca (nova los propios, el tono del autor los ajenos). Al pasar
  encima se leen sus conceptos; al hacer clic, la página se desplaza hasta el
  § y le da el foco. Sigue el alcance míos/todos, desaparece sin marcas y no
  se muestra en pantallas angostas ni al imprimir.

## 0.9.0 — 2026-09-25

- **Navegación y letra del mapa, como en vera.** La letra se acota en
  pantalla (11–40 px) y al acercar crece más lento que el mapa, así que
  acercar separa más de lo que agranda. Arrastrar el fondo desplaza (2D) u
  orbita (3D), la rueda acerca hacia el cursor, el trackpad desplaza y el
  pellizco acerca. Arrastrar nunca selecciona rótulos como texto.
- **Botones de ícono sin borde.** La navegación de la barra (acercar,
  alejar, encuadrar, exportar) va sólo con el ícono; un disco tenue revela
  el área clicable al pasar.
- **«Con§tel» y «Mis anotaciones».** Así se llaman ahora Constelación y Mi
  con§tel en el menú de usuario y en Páginas especiales (los alias de las
  páginas no cambian).
- **Las fuerzas se ven mientras se arrastran.** Mover un control de
  proximidad recalcula el mapa en vivo (a lo más una vez por cuadro) en vez
  de al soltarlo, sin redibujarlo: el layout parte tibio del equilibrio
  anterior y cada concepto se desliza a su lugar nuevo, conservando zoom,
  desplazamiento y concepto elegido. Se acabó el salto al soltar.
- **`docs/MAPA.md`** documenta la vista de constelación: cómo se calculan
  las distancias en 2D y 3D y qué hace cada control de fuerza (rangos,
  valores por omisión, efecto en el layout y en las aristas).

## 0.8.0 — 2026-09-23

- **MiConstel se recorre con filtros.** La tabla va paginada (antes cortaba
  sin avisar en 1000 secciones), se ordena por fecha o estado y se filtra
  por página, concepto y estado, con autocompletado; el filtro queda en la
  URL. Nuevo parámetro `ceids` en `list=constelexcerpts`.
- **Derecho a retirarse.** Sin el derecho `constel-annotate` (p. ej. si se
  le quita a un grupo al cerrar un taller) ya no se crea ni se edita, pero
  las secciones y los temas propios se siguen pudiendo borrar: el detalle,
  MiConstel y los temas del mapa ofrecen sólo «Borrar». Un moderador borra
  secciones ajenas con `constel-moderate` solo.
- **«Diseno» sugiere «Diseño».** La guía de variantes y el autocompletado
  pliegan ahora la ñ como una tilde más, para quien escribe desde un teclado
  sin ñ. Sólo sugiere: la identidad sigue estricta y crear la variante sigue
  pidiendo un gesto explícito. La búsqueda de lectores también («nandu»
  encuentra a «Ñandú»). **Requiere `update.php`**, que recalcula la clave
  tolerante guardada de los conceptos existentes.

## 0.7.0 — 2026-09-23

- **La lista del mapa nombra los temas.** «Ver como lista», la alternativa
  textual del grafo, dice ahora en qué temas de la lente está cada concepto
  («tema: el desastre (Herbert Spencer)»): lo que en el grafo dice el color
  ya no se pierde para quien usa lector de pantalla. Queda anotada, en
  ARCHITECTURE.md, la idea de dibujar envolventes de tema en el mapa.
- **Borrar una página congela sus secciones.** Ya no se pierden: quedan en
  un estado nuevo, `frozen`, en el que sólo se pueden borrar. Su pasaje y su
  glosa los ven sólo su autor y quien tiene `deletedtext`, y no cuentan en el
  mapa. Restaurar la página las re-ancla (o las deja perdidas si el pasaje ya
  no está), también cuando el título se había recreado.
- **MiConstel avisa del borrado.** Una sección congelada lleva el aviso
  «Texto borrado por un administrador», con el motivo y el título que el
  registro de borrados deje ver, y una sola acción: borrarla.
- **Bloqueos parciales en todas las operaciones.** Codificar, descodificar,
  glosar y borrar una sección existente respetan ahora un bloqueo parcial
  sobre su página, como ya lo hacía crearla. Las páginas protegidas se
  siguen pudiendo anotar: anotar no es editar (lo fija un test).
- **La nota se lee junto a su sección.** En el panel de un concepto (y en el
  detalle y en MiConstel) la glosa va pegada a la cita, más sangrada, en
  letra menor y con un filete propio; antes quedaba al margen, menos
  sangrada que la cita, porque el skin le imponía su estilo de párrafo. El
  campo del formulario se llama ahora «Nota (o glosa)».

## 0.6.0 — 2026-09-23

- **El mapa abre en 2D.** Es la vista por defecto de Especial:Constelación
  (3D queda en el selector «Vista»): se lee de un vistazo y se arregla a
  mano.
- **README: marginalia compartida y suelo común.** El README abre con el
  sentido de con§tel, leído en sus textos de Casiopea: la marginalia
  compartida, el suelo común (textos y léxico) para que haya pueblo, los
  gestos § · [a] · [n], el mapa como figura de todos y los antecedentes
  (2005–2006).
- **Pantalla completa del puro mapa.** Un botón en la esquina superior
  derecha del mapa (`maximize`) lo lleva a pantalla completa y ahí cambia a
  `minimize` para salir (también con Esc); el lienzo llena la pantalla y
  sigue su tamaño. «Encuadrar todo el mapa» pasa al ícono `crosshair`.
- **Marca en la barra del mapa.** «CON§TEL» en versales pequeñas y con aire
  entre letras, como isotipo, al inicio de la barra y centrada en su altura.
- **Sin «Peso mínimo» en la barra del mapa.** El umbral global mezclaba
  escalas que no se comparan (§§ compartidos, pares traslapados, páginas
  compartidas) y se pisaba con la fuerza de cada grado, sobre todo con
  «Mismo texto». Cuánto se ve de cada relación lo deciden ahora sólo las
  tres fuerzas; el peso sigue modulando el resorte y el grosor. Los íconos
  de la barra toman más aire respecto de su control.
- **Arreglar el mapa 2D a mano, con el layout en vivo.** En 2D cada
  concepto se arrastra (o se mueve con Alt+flechas sobre él) y el mapa
  reacciona mientras se mueve: sus aristas tiran de los vecinos con la
  fuerza de su grado y los rótulos chocan y se empujan. Queda fijado donde
  se suelta, el resto se enfría sin traslapes y el layout lo respeta al
  cambiar fuerzas, filtros o ir y volver de 3D. Un clic sin arrastrar sigue
  eligiendo el concepto. «Volver al orden automático» (`rotate-ccw`, en la
  barra, sólo en 2D y si hay fijados) los suelta a todos.
- **Las fuerzas ahora se ven en el mapa 2D.** El resorte de cada arista era
  demasiado débil frente a la repulsión (faltaba un factor d) y el layout se
  normalizaba por el concepto más lejano, así que los tres sliders casi no
  cambiaban nada. Ahora el resorte es d²/k, la gravedad sostiene un área
  razonable y en 2D la escala se mide en rótulos: al 100 % el grupo se
  aprieta y al 5 % se abre.
- **Moderación más liviana.** Renombrar un concepto se hace en su título,
  en el panel, con el mismo patrón que el título de un tema (Intro o salir
  guarda, Esc cancela). Bajo el mapa queda sólo fusionar, en una línea
  (ícono `git-merge`, campo y botón) y sin el encabezado «Moderar».
- **Botones del panel más tenues.** «Guardar desarrollo», «Crear tema» y
  «Agrupar» dejan el fondo oscuro sólido: van contorneados como «Fusionar»,
  con borde y texto en `--sn-ink-faint`.
- **Botones de verdad en Especial:MiConstel.** «Exportar (ZIP para con§tel)»
  y «Ver la constelación» son enlaces con clase `constel-button`, y el
  `.sn-body a` del skin les ganaba en especificidad: se veían subrayados y
  en color de enlace. `a.constel-button:is( :link, :visited, … )` les
  devuelve el color del botón (claro sobre oscuro en el primario) y les
  quita el subrayado.

## 0.5.0 — 2026-09-23

- **Especial:Constelación a pantalla completa.** El mapa posee el viewport,
  como la biblioteca con§tel: la barra arriba de borde a borde y, debajo,
  grafo y panel mitad y mitad, cada uno con su propio scroll; el lienzo toma
  la proporción de su celda y la sigue al cambiar el tamaño de la ventana. La
  lista accesible pasa al final del panel y la moderación, al pie del grafo.
  En Stella Nova la página entra al modo `__PANTALLACOMPLETA__` (misma
  propiedad de OutputPage) y el skin absorbe `constel-full`; en pantallas
  angostas grafo y panel se apilan.
- **La división ante-dentro se arrastra.** Ante (el grafo) y dentro (el panel)
  reparten el ancho según se arrastre la línea que los separa (20–80 %);
  también con las flechas (Mayús: pasos largos), Inicio y Fin, y doble clic
  vuelve a mitad y mitad. Cada navegador recuerda la proporción. El lienzo
  conserva su escala: al abrir ante se gana espacio alrededor, no letras más
  grandes.
- **El concepto elegido es el centro del mapa.** Al seleccionar un concepto,
  el mapa se desliza hasta dejarlo al medio y «Girar solo» orbita a su
  alrededor; volver a los temas o «Encuadrar todo» devuelve el centro al
  origen. Con prefers-reduced-motion, salta sin animación.
- **Barra baja, con íconos.** Los controles ya no llevan rótulo encima: cada
  uno va en línea con su ícono Feather (vista `eye`, girar `rotate-cw`,
  aristas `share-2`, peso `filter`, fuerzas `align-left` / `layers` /
  `file-text`, secciones `users`, páginas `file`, temas `tag`) y el nombre
  como tooltip y para lectores de pantalla.
- **Aristas continuas y proximidad parametrizable.** Las aristas ya no son
  punteadas: se distinguen por transparencia. Cada grado de proximidad —misma
  sección (§), traslape, mismo texto— tiene su fuerza (0–100 %) en la barra:
  cuánto atrae a sus conceptos y cuán visible es su arista; en 0 no aparece.
  Por omisión 100 / 60 / 35 %, y se recuerda por navegador.
- **Descarga del SVG arreglada.** La descarga ya no depende de URLs
  blob:/data: del navegador (en Chrome de macOS guardaban el archivo trunco y
  sin extensión): el mapa serializado se envía a la nueva página oculta
  Especial:ConstellationSvg, que lo devuelve como adjunto con
  `Content-Disposition` (`mapa-….svg`). Sólo acepta POST con un SVG válido de
  hasta 2 MB, limpia el nombre y lo sirve con nosniff y CSP sandbox
  (reglas en `Domain\SvgExport`, con pruebas).
- **El tema se edita en su título.** En «Mis temas» desaparecen el campo
  «Renombrar» y el botón «Borrar tema»: el título del tema se reescribe en su
  lugar (Intro o salir del campo guarda; Esc deshace) y una «x» a su lado lo
  borra, previa confirmación bajo el título.
- **Lectura en tres posiciones.** Las tres entradas «con§tel:» del menú de
  usuario pasan a ser un solo control, como en con§tel: − (sin marcas) ·
  § (solo mis secciones) · §* (las de todos). Es un grupo de radios (Tab
  entra, flechas se mueven) y elegir no cierra el menú. «−» conserva el
  alcance elegido.
- **El concepto lleva su signo, [a].** En la nomenclatura de con§tel un
  concepto es un [a] (ancla, p[a]labra, nombre): el título del detalle lo
  antepone en tinta tenue, como el «§» a la sección.
- **Afordancia «§» más discreta.** Deja el círculo de acento por un cuadrado
  de esquinas redondeadas (1,75rem, `--constel-radius-l`) con el token oscuro
  del botón primario y sombra suave. La tinta del «§» ocupa el 60 % del alto y
  queda centrada con márgenes iguales: `trigger.js` mide el glifo en la
  tipografía real y corrige su desplazamiento vertical.
- **2D: los conceptos chocan y nunca se traslapan.** Cada rótulo ocupa su
  caja de tinta (ancho y alto reales del texto) con un margen breve e igual
  por los cuatro lados, centrada en su punto; las cajas que se tocan se
  separan, y el mapa se encuadra al final. Probado sin traslapes con 300
  conceptos sintéticos (170 ms).

## 0.4.0 — 2026-09-22

- **Un desarrollo por tema.** Un tema ya no acumula notas: tiene un solo texto,
  su desarrollo, que se guarda entero («Guardar desarrollo»; vacío lo borra).
  `action=constel-themenote` pasa a `theme` + `text` (sin `op`/`note`);
  `list=constelthemes` devuelve `development` en vez de `notes`. Esquema:
  `constel_note.cn_theme` pasa a índice único; `update.php` funde antes las
  notas que hubiera por tema (en orden, separadas por una línea en blanco). El
  ZIP de export no cambia: el desarrollo viaja como la única «note» del tema.
- **Panel del mapa más sobrio:** títulos h4 (concepto, «Mis temas») y h5 (cada
  tema, «En temas»), sin mayúsculas del skin; el concepto sin «§» delante; el
  tema sin viñeta (su color del grafo va en el título); cada § con su página
  de procedencia enlazada al pie, en texto pequeño, en vez de agruparlos bajo
  el título de la página.
- **Moderación bajo el mapa:** renombrar y fusionar el concepto seleccionado
  salen del panel y quedan debajo del lienzo.
- Campo y botón en la misma línea en los formularios cortos (renombrar tema,
  crear tema, renombrar concepto).

- **«Secciones de» igual que «Temas de»:** parte con quien mira y se suman
  lectores; un interruptor fuera de la caja lo desactiva (= todas las
  secciones; el SVG exportado lleva `all`).
- **Lectores por su nombre real.** Las píldoras y el autocompletado de
  «Secciones de» y «Temas de» (y los títulos «Temas de…») muestran el nombre
  real de Preferencias, con el nombre de usuario como respaldo; se busca por
  cualquiera de los dos, sin tildes. Nueva API `list=constelreaders`
  (`crsearch`/`crnames`): solo lectores de con§tel, respeta
  `$wgHiddenPrefs` y `hideuser`.

- La exportación SVG usa una URL `data:` en vez de `blob:`. **Pendiente:** en
  `http://casiopea.local` Chrome sigue dejando la descarga como «Sin confirmar
  NNN.crdownload»; la causa aún no está confirmada.
- **Nombre del SVG exportado:** `mapa-{2d|3d}-{usuario}-{secciones}.svg`
  (secciones = lectores del filtro «Secciones de», o `all`), en minúsculas y
  sin tildes.

## 0.3.0 — 2026-09-22

- **Desactivada por defecto.** Instalada, la extensión no cambia nada hasta
  que cada lector la activa en su nueva pestaña **Preferencias › con§tel ›
  Activación** (antes estaba en Apariencia y venía encendida). El sitio puede
  cambiar el default con `$wgDefaultUserOptions['constel-enabled'] = 1`.
  README: pasos de instalación y activación.
- **Barra de la constelación rediseñada.** Fila 1: vista 2D/3D con «Girar
  solo» al lado (solo en 3D); «Mostrar aristas» muestra u oculta el peso mínimo
  (1 a 4); zoom. Fila 2: filtros como píldoras con autocompletado: «Secciones de»
  (lectores; vacío = todas), «Páginas» (vacío = todas) y «Temas de» (por
  defecto quien mira; varios lectores; nunca vacía). API: `list=constelgraph`
  cambia `cgscope`/`cgpageid` por `cgusers`/`cgpageids`; `ctuser` admite
  varios lectores. El autocompletado acepta cualquier fuente.
- **Terminología: «sección»** en vez de «pasaje» en toda la interfaz, la
  ayuda de la API y el registro (inglés: *section*). En el código y el spec
  se mantiene `excerpt`.
- **Íconos Feather** en lugar de tipografía en los botones (navegación del
  mapa, cerrar paneles, quitar conceptos y píldoras), con el trazo y los
  colores de ícono de Stella Nova.
- **Exportar el mapa como SVG**: nuevo botón en la navegación del mapa; SVG
  autónomo con colores `rgb()`, título y descripción de los filtros.

## 0.2.0 — 2026-09-22

Ajustes tras D6.

- **Glosa por §**: comentario o aclaración opcional (`ce_gloss`, cambio de
  esquema abstracto + parche por motor), en el formulario, el detalle, el
  mapa, MiConstel y la exportación; `action=constel-glossexcerpt`.
- **Preferencia** `constel-enabled` (Apariencia › con§tel): apagada, las
  páginas se ven sin con§tel y el menú de usuario no lo menciona.
- **Controles en el menú de usuario** (en vez de los indicadores de
  página): solo mis §§ / los de todos / ocultar marcas, más Constelación y
  Mi con§tel.
- **Panel del §**: primero conceptos, después la glosa, y un solo botón
  «Guardar» que aplica todo (quitar con × queda en espera; quitar todos
  advierte «Guardar y borrar el §»). El formulario de creación también
  tiene un solo botón.
- **Páginas anchas**: Especial:Constelación y Especial:MiConstel marcan
  `constel-wide`; Stella Nova ensancha la hoja (skinStyles del skin).
- **Mapa en 3D** (default, con conmutador 2D): órbita y perspectiva;
  «Girar solo» opcional y apagado por defecto; aristas visibles con grosor
  constante.
- **Arista «misma página»** (`co_page`): une conceptos anotados en la misma
  página; la más tenue.

## 0.1.0 — 2026-09-22

Hitos D0–D6 del plan (`docs/ARCHITECTURE.md`).

- Spec de comportamiento en Allium (`specs/casiopea-constel.allium`).
- D0 — esqueleto: `extension.json` (manifest v2), derechos
  `constel-annotate` / `constel-moderate`, grant `constel`, dominio virtual
  de BBDD `virtual-constel`, config `$wgConstel*`, i18n (en, es, qqq).
- Capa de alias de tokens `--constel-*` sobre los tokens semánticos y de
  componente de Stella Nova, con respaldo Codex (`ext.constel.tokens`).
- Tooling: mediawiki-codesniffer, minus-x, parallel-lint, eslint-config-wikimedia,
  stylelint-config-wikimedia, banana-checker.
- `docs/ARCHITECTURE.md`.
- D1 — datos y dominio: esquema abstracto `sql/tables.json` (6 tablas en el
  dominio virtual `virtual-constel`) + SQL generado para MySQL, SQLite y
  Postgres; `SchemaHooks`. Dominio: `ConceptNormalizer` (identidad estricta de
  título MW + clave tolerante para variantes que conserva la ñ), `TextAnchor`,
  `AnchorLocator` (reanclaje por niveles), `CanonicalText` (texto canónico con
  lista de exclusión exportable al cliente). Stores: `ConceptStore`,
  `ExcerptStore`, `ThemeStore` con las cascadas del spec. Service wiring y
  `ConstelServices`. 34 tests unitarios.
- D2 — API: 7 módulos de escritura (`constel-createexcerpt`, `-codeexcerpt`,
  `-uncodeexcerpt`, `-deleteexcerpt`, `-theme`, `-groupconcept`, `-themenote`)
  y 3 de lectura (`list=constelexcerpts`, `constelconcepts`, `constelthemes`).
  El servidor mide el ancla sobre el texto canónico de la revisión vigente
  (`RenderedTextProvider`, cacheado por revid) y exige confirmar variantes.
  Mensajes en `i18n/api/` (en, es, qqq). Tests de integración: 32 (stores + API),
  sobre tablas temporales.
- Nombre `Casiopea-Con§tel`, slug `casiopea-constel`
  (`wfLoadExtension( 'casiopea-constel' )`).
- D3 — § sobre la página: `PageHooks` (solo cuentas registradas, vista de la
  revisión vigente de páginas de contenido), módulo `ext.constel.reader`
  (afordancia «§» con ratón, táctil o Alt+Mayús+Intro; formulario con
  autocompletado del vocabulario compartido y guía de variantes; marcas de §§
  propios y ajenos; detalle para codificar, descodificar y borrar; alcance
  míos/todos y ojo en los indicadores de página), estilos con los tokens de
  Stella Nova. Tests: `PageHooksTest` (PHP) y QUnit del cliente.
- D4 — re-anclaje: `RevisionHooks` (encola `ReanchorJob` tras guardados que
  cambian el contenido de páginas con §§ anclados; al borrar la página, sus §§
  se pierden) y `ReanchorJob` (idempotente, deduplicado por página, contra la
  revisión vigente). Tests: `ReanchorJobTest`. README: instalación y
  desinstalación, sin scripts propios.
- D5 — mapa y páginas especiales: `GraphBuilder` + `list=constelgraph`
  (co_excerpt y overlap, alcance y página); Especial:Constelación (grafo SVG con
  layout propio, detalle de concepto, panel de temas con lente, lista
  accesible; pública en solo lectura); Especial:MiConstel (§§ propios con los
  perdidos y su revisión válida) y exportación ZIP compatible con constel
  (offsets UTF-16). Módulo compartido `ext.constel.ui`. Escala categórica
  `--constel-cat-*`. Guardia contra doble envío en el formulario del §.
  Tests: `GraphBuilderTest`, `ExportBuilderTest`.
- D6 — moderación: `action=constel-moderate` (renombrar y fusionar conceptos,
  con el derecho `constel-moderate`); registro público
  **Special:Log/constel** (renombres, fusiones y borrados de §§ ajenos) vía
  `ModerationLog`; herramientas en el detalle del concepto del mapa. Tests:
  `ApiModerationTest`.
