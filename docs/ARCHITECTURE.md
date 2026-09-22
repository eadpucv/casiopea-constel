# Casiopea-Con§tel — arquitectura

Cómo se construye la extensión. El **qué** (comportamiento observable) está en
[`specs/casiopea-constel.allium`](../specs/casiopea-constel.allium), que es la
fuente de verdad. Este documento cubre el **cómo** y los detalles que el spec
deja fuera a propósito: esquema, API, módulos, algoritmos y diseño visual.

## Doctrina

- **Spec primero.** Un cambio de comportamiento actualiza el `.allium` en el
  mismo commit. `allium check` y `allium analyse` quedan limpios.
- **Todo declarativo.** `extension.json` (manifest v2) registra hooks, API,
  páginas especiales, módulos de ResourceLoader, derechos, grants, mensajes,
  config, autoload PSR-4 y el dominio virtual de BBDD. En `LocalSettings.php`
  solo va `wfLoadExtension` y los overrides de config.
- **Servicios inyectados.** La lógica vive en servicios
  (`ServiceWiringFiles`). Los hooks y los módulos de la API los reciben por
  constructor (`HookHandlers` y `services` en el manifest). Nada de
  `MediaWikiServices::getInstance()` fuera del wiring.
- **El servidor es la autoridad.** El cliente propone; la API valida
  identidad, derechos, bloqueos, largos y revisión vigente.
- **No tocar el contenido.** Anotar no crea revisiones ni invalida la
  ParserCache. Los §§ se pintan en el cliente sobre el DOM ya renderizado.
- **Agnóstica de skin; diseñada para Stella Nova.** Ver § Diseño.

## Estructura

```
extension.json          manifest
i18n/                   en.json · es.json · qqq.json (+ i18n/api/ para la API)
sql/                    tables.json (esquema abstracto) + SQL generado por motor
src/
  ServiceWiring.php
  Hooks/                handlers por interfaz de hook
  Store/                acceso a BBDD (un Store por agregado)
  Domain/               valores y reglas puras: ConceptNormalizer, TextAnchor…
  Api/                  módulos de la Action API
  Specials/             SpecialConstelacion, SpecialMiConstel
  Jobs/                 ReanchorJob
resources/              módulos RL (ext.constel.*)
tests/phpunit/          unit/ (sin BBDD) e integration/ (con BBDD)
tests/qunit/            JS
docs/                   este archivo
specs/                  el spec Allium
```

**Nombre y slug.** El nombre es `Casiopea-Con§tel` (`name` en
`extension.json`, lo que muestra `Special:Version`). El slug es
`casiopea-constel`: carpeta, `wfLoadExtension( 'casiopea-constel' )`,
`remoteExtPath`, clave de `MessagesDirs` y prefijo de mensajes
(`casiopea-constel-desc`). El espacio de nombres PHP es
`MediaWiki\Extension\CasiopeaConstel\`, y los servicios usan el prefijo
`CasiopeaConstel.`, porque un identificador PHP no admite `-` ni `§`.

## Datos

Las tablas viven en el **dominio virtual** `virtual-constel`
(`DatabaseVirtualDomains`). Por defecto usan la BBDD de la wiki, y
`$wgVirtualDomainsMapping` permite moverlas a otra sin tocar código. El
acceso pasa por `IConnectionProvider::getPrimaryDatabase( 'virtual-constel' )`
y `getReplicaDatabase( 'virtual-constel' )`.

El esquema se escribe en formato abstracto (`sql/tables.json`); el SQL de
MySQL, SQLite y Postgres se genera con `generateSchemaSql.php`. Se instala con
`LoadExtensionSchemaUpdates`. Los autores se guardan como **actor id** (sobrevive
a renombres de usuario) y las páginas como **page id** (sobrevive a traslados).
Los timestamps se guardan en formato `binary(14)` de MediaWiki.

Esquema (D1, [`sql/tables.json`](../sql/tables.json)):

| Tabla | Entidad del spec | Columnas clave |
|---|---|---|
| `constel_concept` | Concept | `cc_id`, `cc_key` (único, forma canónica), `cc_fold` (índice, clave tolerante para variantes) |
| `constel_excerpt` | Excerpt | `ce_id`, `ce_actor`, `ce_page`, `ce_rev`, `ce_exact`, `ce_prefix`, `ce_suffix`, `ce_start`, `ce_end`, `ce_gloss`, `ce_status`, `ce_created`, `ce_lost` |
| `constel_coding` | Coding | PK (`ccd_excerpt`, `ccd_concept`), `ccd_timestamp` |
| `constel_theme` | Theme | `ct_id`, `ct_actor`, `ct_label`, `ct_created` |
| `constel_membership` | ThemeMembership | `cm_theme`, `cm_concept`, `cm_actor`; único (`cm_actor`, `cm_concept`) |
| `constel_note` | ThemeNote | `cn_id`, `cn_theme`, `cn_text`, `cn_updated` |

`cm_actor` repite el dueño del tema para que la unicidad «un tema por concepto
y por lector» (`OneThemePerConceptPerReader`) la garantice un índice.

**Cambios de esquema.** Cada cambio posterior a la creación se escribe como
cambio abstracto en `sql/abstractSchemaChanges/`, y el SQL por motor se genera
con `generateSchemaChangeSql.php`. `SchemaHooks` lo aplica con `addField` y
similares, en el mismo dominio virtual. El primero es `ce_gloss`, la glosa
del §.

Reglas en cascada del spec: un § sin codificaciones se borra
(`UncodedExcerptVanishes`) y un concepto sin codificaciones se borra junto con
sus pertenencias (`UnusedConceptVanishes`). Se aplican en la misma transacción
que la escritura que las provoca, no con triggers SQL.

## Conceptos

La identidad de un concepto es **estricta, como la de un título de
MediaWiki** (decisión del 2026-09-22): «Diseño» y «Diseno» son conceptos
distintos. `normalize_concept` produce la forma canónica, que es la clave:

1. Normalización Unicode NFC.
2. `_` pasa a espacio; se hace trim y los espacios internos se colapsan a uno.
3. La primera letra va en mayúscula si `$wgCapitalLinks` está activo (como en
   los títulos del namespace principal). El resto queda **exacto**:
   mayúsculas, tildes, diéresis y ñ se respetan.

Es la misma equivalencia que `Title` aplica a la parte textual de un título,
sin las restricciones de caracteres de los títulos (un concepto puede llevar
`#`, `[`, `|`…, porque es un rótulo, no un enlace).

**La convergencia a la forma bien escrita se hace al escribir, no en la
identidad.** El popup busca **variantes**, es decir, conceptos que difieren
solo en tildes, diéresis, mayúsculas o espacios. Para eso usa una clave de
comparación tolerante que **solo sirve para sugerir**, nunca para
identificar. Si hay variantes, las ofrece antes de crear un concepto nuevo
(`VariantsSteered`). Crear la variante igual es posible, con un gesto
explícito. Si una variante se cuela, un administrador la renombra o la
fusiona, igual que en la wiki se unifican títulos con traslados y
redirecciones.

La clave tolerante es: NFD, se quitan las marcas combinantes **salvo la tilde
de la ñ** (la ñ es una letra: «año» y «ano» no son variantes), minúsculas y
espacios colapsados. Se guarda indexada (`cc_fold`) para que la búsqueda de
variantes no recorra la tabla.

Las dos funciones tienen una implementación de referencia en PHP. El cliente
porta la clave tolerante a JS y la valida contra una tabla de casos
compartida.

## Anclaje

Un § guarda un `TextAnchor` al estilo W3C Web Annotation: `exact`, `prefix`,
`suffix` (`$wgConstelAnchorContextLength` caracteres) y `start`/`end`.

**Texto canónico.** Todas las medidas se hacen sobre el *texto plano
renderizado* del cuerpo: el `textContent` de `.mw-parser-output`, sin los nodos
excluidos (`script`, `style`, `.mw-editsection`, `.mw-cite-backlink`,
`.mw-empty-elt` y lo que se sume en D3). El cliente (DOM) y el servidor (HTML
de `ParserOutput` recorrido con el DOM de PHP) usan **la misma lista de
exclusión**. PHP la define y la exporta al cliente en un `packageFiles` con
callback de config, así no hay dos copias.

**Unidades.** Los offsets están en *code points* Unicode, no en unidades UTF-16.
El cliente convierte con `Array.from` y el servidor usa funciones `mb_*`.

**Creación.** El cliente envía el revid que está mostrando. Si no es el último,
la API responde `constel-stale-revision` y el popup conserva lo escrito.

**Reanclaje** (`anchor_resolves` / `relocate`), en `ReanchorJob`:

1. Se buscan todas las ocurrencias de `exact` en el texto canónico de la
   revisión nueva.
2. Se filtran las que coinciden con `prefix` y `suffix`; con empate, gana la
   más cercana a `start`.
3. Si queda exactamente una, el ancla se traslada (se recalculan
   `start`/`end`, `prefix` y `suffix`) y `ce_rev` apunta a la revisión nueva.
4. Si no queda ninguna, o sigue habiendo ambigüedad, el § pasa a `lost`.

El job se encola desde `PageSaveComplete` (solo si la revisión cambió el
contenido) y desde `PageDeleteComplete`. Es idempotente: si llega tarde y ya
hay una revisión más nueva, trabaja contra la más nueva.

## Re-anclaje (D4)

`RevisionHooks`:

- **`PageSaveComplete`:** si la revisión cambió el contenido (no es una edición
  nula) y la página tiene §§ anclados (`hasAnchored`, una consulta con
  `LIMIT 1`), encola `ReanchorJob` con `lazyPush` y `removeDuplicates`, por
  página. El guardado nunca espera el re-anclaje.
- **`PageDeleteComplete`:** marca como perdidos los §§ anclados de la página, en
  el acto (es un solo `UPDATE`). Restaurar la página no los revive.

`ReanchorJob` (`JobClasses`, `needsPage`, servicios inyectados): lee la
revisión **vigente al correr**, no la que lo encoló, así que es idempotente y
tolera llegar tarde. Obtiene su texto canónico (`RenderedTextProvider`) y, para
cada § anclado a una revisión anterior, lo traslada (`relocate`) o lo pierde
(`markLost`). Si el render falla, devuelve `false` y la cola lo reintenta.

Mientras el job no corre, el cliente recibe §§ con un `revid` anterior; `marks.js`
los ubica por la cita. Por eso el invariante `AnchoredMeansCurrent` se cumple de
forma eventual.

## Mapa y páginas especiales (D5)

**`GraphBuilder`** (servicio; `list=constelgraph`) arma el grafo en una sola
consulta sobre codificaciones y §§:

- **co_excerpt:** por cada §, cada par de sus conceptos. Peso = número de §§.
- **co_page:** por cada página, cada par de conceptos anotados en ella (por
  cualquier lector). Peso = número de páginas compartidas. Es la arista más
  tenue y la que menos atrae en el layout.
- **overlap:** por página, ordenando los §§ **anclados** por inicio y
  recorriéndolos en barrido, cada par de §§ de lectores **distintos** cuyos
  rangos comparten al menos un carácter une cada concepto de uno con cada
  concepto del otro. Peso = número de pares. Nunca fusiona conceptos
  (`OverlapNeverConverges`). *Pendiente: confirmar si esta arista se
  mantiene (open question del spec).*
- **Nodos:** número de §§, número de páginas y `mine` (si quien mira aportó).
  Alcance `mine` y filtro por página.

Hoy se calcula al vuelo. Si el volumen crece, se cachea en `WANObjectCache` con
una *check key* que tocan las escrituras.

**Especial:Constelación** (`SpecialConstellation`, pública). El servidor emite
la lista de conceptos por frecuencia, que sirve de respaldo sin JS. El módulo
`ext.constel.map` dibuja encima:

- `graph.js`: layout de fuerzas propio en **3D** (default) o 2D, sin
  dependencias: repulsión, resortes con fuerza según el peso, gravedad y
  atracción al centroide del tema. Se normaliza a una esfera y se proyecta en
  perspectiva sobre SVG. Lo lejano se atenúa y lo cercano se pinta encima. Se
  orbita arrastrando o con las flechas (en 2D se panea). «Girar solo» es
  opcional y viene **apagado** (WCAG 2.2.2: el movimiento automático debe poder
  detenerse); se recuerda por navegador y nunca actúa con
  `prefers-reduced-motion`. Con el puntero encima se detiene para poder apuntar. Los rótulos miden entre 11 y 31 px (0.6·§§ + 0.4·páginas, como
  constel) y escalan con la perspectiva. Las aristas tienen grosor constante en
  pantalla (`vector-effect: non-scaling-stroke`), y las `overlap` van punteadas.
  Zoom con botones o Ctrl+rueda. Cada nodo es texto SVG enfocable (Enter lo
  abre).
- `sidepanel.js`: el detalle de un concepto (sus §§ por página, en qué temas
  está, agruparlo) y el panel de temas (crear, renombrar, borrar, desagrupar,
  notas). Los temas de otro lector (la **lente**) se muestran en solo lectura.
- `map.js`: controles (alcance, página, umbral, aristas, lente, zoom) y la
  lista navegable (`AccessibleAlternative`).

**Página ancha.** Las dos páginas especiales agregan `<body class="constel-wide">`.
Qué significa lo decide el skin: Stella Nova la absorbe en
`skinStyles/constel.css` (`ResourceModuleSkinStyles` sobre
`ext.constel.map.styles`) y ensancha la hoja a `--sn-shell`. En otros skins no
tiene efecto.

**Especial:MiConstel** (`SpecialMyConstel`, cuentas registradas): tabla de
§§ propios, anclados y perdidos. Cada § perdido enlaza al `oldid` donde era
válido. `ext.constel.mine` agrega «Editar», que reutiliza el detalle del §.

**Exportación** (`Especial:MiConstel/export`, `ExportBuilder`): genera un ZIP
con `constel-db.json` y `corpus/<página>.txt`, que el «Importar» de constel
v0.2.x abre. Convierte los offsets de code points a unidades UTF-16 sobre el
cuerpo sin frontmatter y con `trim()`, que es como mide constel. Los §§
perdidos no se exportan. Cada tema propio se exporta con su color de la paleta
de constel, y cada concepto con el `themeId` que le dio el lector.

**Módulos RL:** `ext.constel.ui` reúne lo compartido (API, panel,
autocompletado, variantes, detalle del §). Encima van `ext.constel.reader`,
`ext.constel.map` y `ext.constel.mine`. Los estilos comunes están en
`ext.constel.ui/ui.css`. La escala categórica `--constel-cat-0…7` apunta a
`--sn-cat-*`, que Stella Nova aún no tiene. Mientras tanto, el respaldo es la
paleta de constel mezclada con la tinta, para que el contraste siga al tema.

## API

**Escritura** (`ApiConstelWriteBase`): todos los módulos son POST, exigen token
CSRF y están en modo escritura. Antes de tocar datos comprueban:

- que sea una cuenta registrada (`isNamed()`): ni anónimos ni cuentas
  temporales;
- el derecho `constel-annotate`;
- que no haya un bloqueo sitewide;
- en los módulos que tocan una página, también los bloqueos parciales
  (`checkTitleUserPermissions`);
- que el pasaje, tema o nota pertenezca a quien lo modifica. Borrar pasajes
  ajenos requiere `constel-moderate`.

| Módulo | Spec |
|---|---|
| `constel-createexcerpt` | ReaderCreatesExcerpt |
| `constel-codeexcerpt` | ReaderCodesExcerpt |
| `constel-uncodeexcerpt` | ReaderUncodesExcerpt (+ UncodedExcerptVanishes) |
| `constel-deleteexcerpt` | ReaderDeletesExcerpt |
| `constel-theme` (`op=create\|rename\|delete`) | ReaderCreates/Renames/DeletesTheme |
| `constel-groupconcept` (`op=group\|ungroup`) | ReaderGroups/UngroupsConcept |
| `constel-themenote` (`op=create\|edit\|delete`) | ReaderWrites/Edits/DeletesThemeNote |

`constel-createexcerpt` recibe el pasaje tal como lo midió el cliente, pero
**no confía en esa medición**. Primero verifica que el `revid` sea la última
revisión (si no, `staleview`). Después obtiene el texto canónico de esa
revisión (`RenderedTextProvider`: opciones de parser canónicas, sin TOC ni
enlaces de sección, cacheado por revid) y ubica el pasaje con
`AnchorLocator`. Lo que se guarda es la medición del servidor. Si hace falta
crear un concepto nuevo y existen variantes, responde `variants` con la lista,
salvo que venga `allowvariant=1` (`VariantsSteered`).

**Lectura** (públicas; también las usan los anónimos para el mapa):

- `list=constelexcerpts`: con `cepageid`, los §§ anclados de una página; con
  `ceuser`, todos los de un lector, incluidos los perdidos.
- `list=constelconcepts`: `ccsearch` es el autocompletado, que ignora tildes y
  mayúsculas y ordena por uso; `ccvariantsof` y `ccids` completan el set.
- `list=constelthemes`: los temas de un lector (`ctuser`) o por id, con sus
  conceptos y notas.

El nombre de un autor oculto (`hideuser`) solo se muestra a quien tiene
`hideuser`; por eso esas respuestas son `anon-public-user-private`.

Los mensajes de ayuda y de error viven en `i18n/api/`.

## Moderación (D6)

`constel-moderate` (`op=rename|merge`) exige una cuenta registrada con
`constel-moderate` (por defecto, `sysop`) y sin bloqueo sitewide:

- **rename:** cambia la forma canónica. Si el rótulo nuevo ya es de otro
  concepto, responde `labeltaken`, porque eso es una fusión y no un renombre.
- **merge:** `concept` se absorbe en `into`. Sus codificaciones y
  pertenencias pasan al concepto que queda, sin duplicar; en los temas de cada
  lector gana la pertenencia que ya tenía `into`.

`ModerationLog` publica en **Special:Log/constel** (`LogTypes`, formateador
estándar `LogFormatter`, mensajes `logentry-constel-*`):

- `rename`: rótulo anterior → nuevo; destino, Especial:Constelación.
- `merge`: concepto absorbido → el que queda; destino, Especial:Constelación.
- `delete`: un moderador borró el § de otro lector; destino, la página del §,
  con el autor y el pasaje citado (recortado a 200 caracteres).

Borrar un § propio no se registra.

En el mapa, el detalle de un concepto muestra estas herramientas solo a
quien modera: renombrar, y fusionar en otro concepto elegido con
autocompletado, con confirmación en línea.

## Lectura en la página (D3)

`PageHooks::onBeforePageDisplay` carga `ext.constel.reader` solo si se cumplen
todas estas condiciones:

- la cuenta es registrada (los anónimos no ven nada sobre las páginas; su
  acceso es el mapa);
- la acción es `view`, sin `diff`;
- la página es de contenido, existe y no es redirección;
- se está viendo la **revisión vigente**.

Pasa al cliente `wgConstel` con `pageId`, `revId`, `canAnnotate` (derecho y
bloqueos, con `RIGOR_FULL`) y `canModerate`. Nada de esto entra al parseo, así
que el HTML cacheado no cambia.

Módulos:

- `ext.constel.reader.styles`: los alias de tokens y `reader.css`. Se carga con
  `addModuleStyles`, sin esperar al JS.
- `ext.constel.reader` (`packageFiles`):

| Archivo | Rol |
|---|---|
| `canonical.js` | Texto canónico en el DOM, espejo de `CanonicalText`; `TextIndex` convierte entre code points y UTF-16 |
| `locate.js` | Espejo de `AnchorLocator` |
| `marks.js` | Dibuja §§ como `<mark>` (solo en el cliente); si el DOM difiere, re-ubica por la cita |
| `trigger.js` | La afordancia «§»: aparece al terminar una selección válida; con teclado, Alt+Mayús+Intro |
| `form.js` | Formulario del §: autocompletado, variantes, aviso de datos públicos, vista vieja |
| `detail.js` | Detalle de los §§ bajo un punto. Sobre el propio es un formulario con los cambios en espera (conceptos, agregar concepto, glosa) y **un solo botón «Guardar»**; si se quitan todos los conceptos, el botón advierte que borra el §. Quien modera ve «Borrar» en §§ ajenos |
| `variants.js` | Respuesta común al error `variants` |
| `panel.js` | Panel emergente: Escape, clic fuera, foco retenido y devuelto, dentro del viewport |
| `autocomplete.js` | Combobox ARIA sobre `list=constelconcepts&ccsearch` |
| `menu.js` | Da comportamiento a las entradas del menú de usuario (solo mis §§ / los de todos / ocultar marcas) y refleja el estado; se recuerda por navegador (`mw.storage`) |
| `config.json` | Callback PHP: la lista de exclusión y los límites, los mismos del servidor |

La UI de con§tel lleva la clase `constel-ui`, que está en la lista de
exclusión: nunca contamina el texto canónico. Las marcas **no** la llevan,
porque su texto es el de la página.

**Menú de usuario** (`onSkinTemplateNavigation__Universal`): para cuentas
registradas agrega entradas al portlet `user-menu`, antes de «Salir». En
vistas de lectura van los tres controles (sin JS se ocultan con
`.client-nojs`); en todas partes, los enlaces a Constelación y Mi con§tel. Es
el mecanismo estándar de portlets, así que funciona igual en Stella Nova y en
Vector, y queda al alcance en páginas largas porque la cabecera es fija.

**Preferencias:**

- `constel-enabled` (interruptor en Apariencia › con§tel, default sí):
  apagado, la vista no carga nada de con§tel y el menú de usuario no lo
  menciona: ni controles ni enlaces (`DisabledByPreference`). Constelación y
  Mi con§tel siguen en Páginas especiales.
- `constel-public-ack` (tipo `api`, oculta): el lector ya vio el aviso de que
  sus anotaciones son públicas.

**Glosa:** cada § puede llevar una glosa opcional, que es un comentario o una
aclaración (`ce_gloss`, hasta `$wgConstelGlossMaxLength` caracteres). Se
escribe al crear el §, en el mismo formulario (Ctrl+Intro envía), y su autor la
edita o la vacía desde el detalle (`constel-glossexcerpt`). Se muestra en el
detalle, en el mapa y en MiConstel, y se exporta como campo extra `gloss` de
cada excerpt.

## Diseño

La GUI tiene que ser **totalmente compatible con Stella Nova** y usar sus
tokens. Al mismo tiempo, la extensión tiene que funcionar con cualquier skin
(contrato `SkinAgnostic`). Se resuelve con una capa de alias:

- [`resources/ext.constel.tokens.css`](../resources/ext.constel.tokens.css) es el
  **único** archivo que nombra tokens `--sn-*`. Define alias `--constel-*`
  en `:root`.
- Cada alias apunta a un token **semántico o de componente** de Stella Nova
  (`--sn-paper-raised`, `--sn-ink`, `--sn-nova`, `--sn-btn-*`,
  `--sn-field-*`, `--sn-focus-*`…), **nunca a primitivas** (`--sn-papel-*`,
  `--sn-tinta-*`). Las primitivas son internas del skin; los tokens
  semánticos y de componente son su contrato público.
- Cada alias tiene un respaldo en cadena: primero el token Codex/WikimediaUI
  equivalente y al final un literal. En Vector o Minerva la extensión se ve
  como una extensión Codex estándar.
- Los componentes (`ext.constel.*.css`) consumen **solo** `--constel-*`. No hay
  hex, px sueltos ni fuentes propias: la tipografía es la del skin.
- El claro/oscuro se hereda: Stella Nova usa `light-dark()` y `color-scheme`, y
  un `var()` guardado en una custom property conserva el `light-dark()` sin
  evaluar hasta donde se usa.
- La nova (`--sn-nova`) es el único acento: el signo §, el foco y las marcas
  propias. Las marcas ajenas usan tinta tenue.
- **Falta en Stella Nova:** una escala categórica semántica para colorear los
  temas en el mapa (constel usa 12 hex fijos). Se propondrá agregar
  `--sn-cat-1…n` al skin en D5, en lugar de consumir primitivas desde aquí.

## Calidad y tests

- `composer test`: parallel-lint, phpcs (mediawiki-codesniffer 45, la
  generación de 1.43) y minus-x.
- `npm test`: eslint-config-wikimedia, stylelint-config-wikimedia y
  banana-checker.
- PHPUnit, unitarios: `tests/phpunit/unit` (dominio puro: normalización,
  variantes, ancla, localizador, texto canónico). Corren con el PHPUnit
  **propio** de la extensión (`composer phpunit`, 9.6.19, la versión que fija
  el core 1.43) y sin levantar MediaWiki. Solo toman del core las librerías de
  `vendor/` que usa el dominio (RemexHtml); `MW_INSTALL_PATH` indica dónde está
  el core.
- PHPUnit, integración: `tests/phpunit/integration` (stores y API), con
  `MediaWikiIntegrationTestCase` / `ApiTestCase` y tablas temporales. Se corren
  desde el core: `cd w && php vendor/bin/phpunit extensions/casiopea-constel/tests/phpunit`.
  En la réplica local, las dependencias de desarrollo del core se reponen con
  `scripts/install-core-dev.sh`, porque los scripts de fase usan `--no-dev`.
  Estos tests fijan `wgLanguageCode = es`: el entorno de tests fuerza `en`, y
  SemanticMediaWiki aborta si cambia el idioma.
- QUnit: `tests/qunit` (TextIndex, localizador, texto canónico del DOM). Se
  corre en `Especial:JavaScriptTest/qunit?module=ext.constel.reader`, que exige
  `$wgEnableJavaScriptTest` (activado solo en la réplica local).

## Privacidad

Pasajes, codificaciones, temas y notas son **públicos** en la wiki
(`ReadingIsPublicData`). La primera vez que el lector anota, la interfaz se lo
advierte. Los autores se muestran por nombre, salvo que el core los tenga
suprimidos (`hideuser`). En ese caso se muestra como en el resto de MediaWiki.

## Hitos

| | Hito | Contenido |
|---|---|---|
| D0 | Esqueleto | manifest, i18n, derechos/grant, tokens, tooling, este doc |
| D1 | Datos | `tables.json`, stores, dominio (normalizer, anchor), PHPUnit |
| D2 | API | escritura y consulta |
| D3 | § en la página | popup, autocompletado, resaltado, toggles |
| D4 | Reanclaje | `ReanchorJob` + hooks de página |
| D5 | Especiales | Constelación (mapa), MiConstel, exportación ZIP |
| D6 | Moderación | renombrar/fusionar, `Special:Log/constel` |
