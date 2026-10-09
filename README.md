# Casiopea-Con§tel

Con§tel es una herramienta de anotación para MediaWiki donde los
lectores/anotadores comparten su marginalia, su léxico y sus notas. Se trata de
la construcción de un suelo común para el estudio.

Esta extensión la trae a [Casiopea](https://wiki.ead.pucv.cl), la wiki de la
e[ad] PUCV. Viene del proyecto de investigación
[Con§tel](https://wiki.ead.pucv.cl/Con%C2%A7tel) (PUCV, 2004–2006). Para
usarla, el [Manual de con§tel](https://wiki.ead.pucv.cl/Manual_de_con%C2%A7tel);
para entender de dónde sale, [El acto de leer en Con§tel](https://wiki.ead.pucv.cl/El_acto_de_leer_en_Con%C2%A7tel).

> Allí donde haya lector estaré yo.

## Marginalia compartida

Quien estudia lee con lápiz: subraya, pone un título al margen, escribe una
nota junto al párrafo. Esa marginalia ha sido siempre del ejemplar de cada uno
y se pierde con él.

Con§tel la lleva a un lugar común. Lo que cada lector marca, titula y anota
queda junto a lo que marcan los demás sobre los mismos textos, y la relación
entre autor y lector se vuelve un diálogo entre muchos. La ponencia de 2006 lo
dice así: pasar *desde la marginalia compartida hacia una conformación de la
figura de pueblo*.

## Un suelo común

Para que las lecturas se encuentren hace falta un suelo común. Con§tel lo pone
en dos capas:

- **Textos comunes.** Todos leen y anotan sobre el mismo cuerpo. El proyecto
  original partió de los textos fundamentales de la Escuela, escritos entre 1952
  y 2002, para darle a la comunidad *«a solid ground for dialogue»* (*Con§tel:
  Sharing Marginalia*). En Casiopea ese cuerpo es la wiki, y la
  [Biblioteca Con§tel](https://wiki.ead.pucv.cl/Biblioteca_Con%C2%A7tel) reúne
  los *Textos Fundamentales* y las *Publicaciones de Apertura*. «Casiopea es un
  intento de Con§tel», dice la página del proyecto.
- **Un léxico común.** Cada concepto es uno solo para todos. Al asignarlo, el
  lector puede descubrir que otro ya lo había nombrado.

Cada sección sigue siendo de su lector, y cada tema, con su desarrollo, es la
lectura propia de quien lo escribe. Si dos lectores marcan pasajes que se
solapan, quedan dos lecturas, cada una con sus conceptos, y el mapa muestra que
se encontraron.

## Los gestos del lector

Sobre el texto, el lector hace lo que los glosadores en el scriptorium:

| Gesto | Signo | En la extensión |
|---|---|---|
| Distinguir un pasaje | **§** | Al seleccionar texto aparece **§**, y el pasaje se vuelve una *sección* anclada a la página. |
| Titularlo | **[a]** | Se le asignan conceptos del léxico común. El **[a]**, de *ancla*, *p[a]labra* o *nombre*, es la unidad del mapa. |
| Anotarlo | **[n]** | Se le agrega una *glosa*, que es opcional. |

Después, cada lector agrupa sus conceptos en **temas** y escribe el
**desarrollo** de cada tema: el paso de la marginalia al texto propio.

## La constelación

`Especial:Constelación` dibuja todas las lecturas juntas. Los conceptos se
acercan cuando un mismo lector los pone sobre un pasaje, cuando lectores
distintos marcan pasajes que se tocan y cuando aparecen en un mismo texto. Cada
lector ve en el mapa dónde cae su aporte entre los de sus pares.

- **Tres grados de proximidad** unen los conceptos: la *misma sección*, el
  *traslape* entre secciones de lectores distintos y el *mismo texto*. Cada
  grado tiene su propia fuerza (0–100 %), que reacomoda el mapa en vivo
  mientras se ajusta, y en 0 no se dibuja. Cómo se calculan las distancias,
  qué hace cada control (con sus íconos) y qué parámetros tiene el mapa:
  [`docs/MAPA.md`](docs/MAPA.md).
- **Vista 2D (por defecto) o 3D**, con un interruptor. En 2D los rótulos
  nunca se pisan y cada concepto se arrastra con el mapa reaccionando en
  vivo: sus aristas tiran de los vecinos y los rótulos se empujan. El
  concepto elegido se destaca en negrita sin mover el encuadre (el centro es
  siempre el de la escena completa), y en 3D «Girar solo» orbita con niebla
  en profundidad. En iOS y móviles el mapa se dibuja sin desenfoque ni
  animaciones, con el texto en el color del tema.
- **Palabras o nodos.** Otro interruptor dibuja cada concepto como su palabra
  (tamaño según su frecuencia) o como un círculo del color de su tema, útil
  cuando el mapa es denso.
- **Anillos.** Un concepto al centro y sus vecinos en tres anillos, uno por
  grado de proximidad.
- **Varios lectores.** Cada lector tiene un color, que se elige en su píldora,
  y los conceptos se pintan con el de quien los aporta. Se puede ver sólo lo
  compartido o sólo lo propio.
- **Pensado para lecturas muy grandes.** El grafo se guarda en caché y cada
  costo tiene un tope (conceptos, palabras, aristas dibujadas).
- **Pantalla completa.** El mapa (*ante*) y el panel de lectura (*dentro*)
  se reparten la pantalla, y la división entre ambos se arrastra.
- **Filtros** por lectores y por páginas, y una **lente** para leer los temas
  de uno o varios lectores. El mapa se exporta como SVG, y un botón copia el
  código `{{#constel: …}}` que reproduce el mapa tal como está.
- **Panel de referencias.** A pantalla completa y en las incrustaciones, un
  concepto elegido abre un panel flotante (arrastrable y redimensionable) con
  sus páginas, secciones y conceptos vecinos, unidos con líneas de árbol. Los
  conceptos son enlaces al mapa (`?concept=…&users=…`) con las secciones de
  quien anotó; nunca abren «Todos». Detalle en [`docs/MAPA.md`](docs/MAPA.md),
  sección 16.
- **La lectura.** La ventana de un § se une al texto marcado con un hilo fino,
  y su trazo del minimapa se yergue mientras está abierta.

## Insertar el mapa en cualquier página

La parser function `{{#constel: …}}` (también `{{#con§tel: …}}`) pone un
**mapa limpio**, sin controles ni panel, en cualquier página de la wiki. Todos
los parámetros son opcionales: sin ninguno se ve el mapa de todos los lectores,
en 2D.

```wiki
{{#constel:}}
{{#constel: usuario=Herbert | modo=3d | conceptos=nodos | alto=400px}}
{{#constel: concepto=Diseño | paginas=Amereida | class=full-width}}
```

| Parámetro | Valores | Por omisión |
|---|---|---|
| `usuario` | uno o varios lectores, separados por `;` | todos |
| `concepto` | concepto de foco: se resalta (si no existe en el mapa, se ignora) | ninguno |
| `modo` | `2d` o `3d` | `2d` |
| `girar` | `sí` o `no` (sólo en 3D) | `no` |
| `aristas` | `sí` o `no` | `sí` |
| `conceptos` | `palabras` o `nodos` | `palabras` |
| `paginas` | páginas separadas por `;` | todas |
| `alto` | alto del mapa: `px`, `em`, `rem`, `vh`, `dvh` o `%` | `480px` |
| `fuerza-seccion`, `fuerza-traslape`, `fuerza-pagina`, `fuerza-tema` | 0 a 100 | 25 (con varios usuarios: traslape 100, mismo texto 0) |
| `class` | clases CSS que se suman al contenedor (p. ej. `full-width` o su sinónimo `ancho-completo`, que en Stella Nova lo lleva a sangre y sin esquinas redondeadas) | ninguna |

El `:` es obligatorio aun sin argumentos: es lo que distingue una parser
function de una plantilla. El resultado no depende de quién mira (es
cacheable) y no usa las preferencias del navegador; un clic en un concepto lo
resalta y abre su panel de referencias. Puede haber varios mapas en una página. Cómo funciona por
dentro: [`docs/MAPA.md`](docs/MAPA.md), sección 15.

En cada página, el menú de usuario ofrece la lectura en tres posiciones:
**−** sin marcas, **§** solo las propias, **§\*** las de todos.
`Especial:MiConstel` reúne la lectura propia y la exporta.

Estado: **versión 0.17.0**. Extensión para MediaWiki 1.43 LTS. La GUI se
diseña sobre los tokens de [Stella Nova](https://github.com/hspencer/stella-nova)
y funciona con cualquier skin.

## Antecedentes

- *con§tel, Redes Abiertas de Conocimiento*. Spencer, Sanfuentes, con
  Barahona, Abad, Vera y Tapia. MX Design Conference, Universidad
  Iberoamericana, Ciudad de México, 2005.
- *Desde la Marginalia Compartida hacia una Conformación de la Figura de
  Pueblo*. Spencer, Sanfuentes, Barahona. Universidad de Palermo, 2006.
- *Con§tel: Sharing Marginalia*. Spencer. Pittsburgh, 2006.
- Proyecto de investigación *Con§tel* (PUCV DII, 2004–2006) y el proyecto de
  titulación *Red Abierta de Conocimiento Académico Con§tel* (Abad, Vera,
  Tapia; 2004–2005). Ver la página
  [Con§tel](https://wiki.ead.pucv.cl/Con%C2%A7tel) en Casiopea.

## Especificación primero

- [`specs/casiopea-constel.allium`](specs/casiopea-constel.allium): el
  comportamiento. Es la fuente de verdad.

```bash
allium check   specs/casiopea-constel.allium
allium analyse specs/casiopea-constel.allium
```

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): cómo se construye (datos,
  anclaje, mapa, API, diseño, tests) y los hitos D0–D6.

## Instalación

1. **Clonar** el repo en `extensions/`:

   ```bash
   cd extensions
   git clone https://github.com/hspencer/casiopea-constel.git
   ```

2. **Cargarla** en `LocalSettings.php`:

   ```php
   wfLoadExtension( 'casiopea-constel' );
   ```

3. **Crear las tablas** con el `update.php` estándar:

   ```bash
   php maintenance/run.php update
   ```

   No hace falta ningún script propio: el esquema se instala con
   `LoadExtensionSchemaUpdates`, en el dominio de base de datos
   `virtual-constel`.

4. **Cada lector la activa en sus preferencias.** Instalada, la extensión
   viene **desactivada** para todos: las páginas se ven igual que antes. Cada
   usuario registrado la enciende en **Preferencias › con§tel ›
   Activación** («Usar con§tel en las páginas»). Desde ese momento, al
   seleccionar texto aparece §, se ven las marcas de pasajes y el menú de
   usuario muestra los controles de lectura. La constelación
   (`Especial:Constelación`) y la lista propia (`Especial:MiConstel`) están
   siempre disponibles en Páginas especiales, aun con la extensión
   desactivada.

   Si el sitio prefiere que venga activada para todos, basta con cambiar el
   valor por defecto en `LocalSettings.php` (cada lector puede apagarla
   igual):

   ```php
   $wgDefaultUserOptions['constel-enabled'] = 1;
   ```

### Desinstalación

Basta con quitar el `wfLoadExtension`. **Las páginas no se ven afectadas**,
porque con§tel no guarda nada dentro de las revisiones ni del wikitexto (a
diferencia de extensiones como InlineComments, que usan un slot propio y
rompen las páginas al desinstalarlas). Lo que queda es inerte:

- las seis tablas `constel_*`, que se pueden conservar para una reinstalación
  o borrar con `DROP TABLE`;
- la preferencia oculta `constel-public-ack` en `user_properties`, sin efecto;
- los jobs `constelReanchor` pendientes: conviene vaciarlos antes con
  `maintenance/run.php runJobs --type constelReanchor`, porque la cola no
  sabría ejecutarlos.

**Nombre y slug.** La extensión se llama **Casiopea-Con§tel**, y así aparece en
`Special:Version`. Su slug es **`casiopea-constel`**: es el nombre de la
carpeta, el argumento de `wfLoadExtension`, la ruta de los recursos y el
prefijo de los mensajes. El espacio de nombres PHP es
`MediaWiki\Extension\CasiopeaConstel\`, porque un identificador PHP no
admite `-` ni `§`.

Derechos: `constel-annotate` (por defecto, `user`) y `constel-moderate` (por
defecto, `sysop`). Grant OAuth / bot password: `constel`.

## Desarrollo

```bash
composer install && composer test   # parallel-lint, phpcs, minus-x
npm install && npm test             # eslint, stylelint, banana-checker
```

## Licencia

Artistic License 2.0 (`Artistic-2.0`). Ver [`COPYING`](COPYING).
© 2026 Herbert Spencer González, .:TIG:. e[ad] PUCV, Corporación Cultural Amereida.
