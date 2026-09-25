# Changelog — Casiopea-Con§tel

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
