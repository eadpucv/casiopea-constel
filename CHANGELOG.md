# Changelog — Casiopea-Con§tel

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
