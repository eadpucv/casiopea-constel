# Casiopea-Con§tel

**Marginalia compartida** para [Casiopea](https://wiki.ead.pucv.cl), la wiki de
la e[ad] PUCV. Es la aplicación a MediaWiki de
[con§tel](https://github.com/hspencer/constel), un proyecto de la Escuela que
nació entre 2004 y 2006.

> Allí donde haya lector estaré yo.

## Marginalia compartida

Quien estudia lee con lápiz. Subraya, pone títulos al margen, anota y le
responde al autor en el blanco de la página. Esa marginalia ha sido siempre
íntima: queda en el ejemplar de cada uno y se pierde con él.

con§tel lleva ese gesto a un lugar común. Las lecturas de cada lector, sus
pasajes, títulos y notas, quedan junto a las de los demás sobre los mismos
textos. La relación entre autor y lector, privada y asimétrica, se vuelve un
diálogo entre pares. El lector, sin darse cuenta, se vuelve autor y ve cómo
su pequeño aporte modifica el mapa de todos. La idea es la de la ponencia de
2006: pasar *desde la marginalia compartida hacia una conformación de la figura
de pueblo*.

## Un suelo común para que haya pueblo

Una comunidad no nace de anotaciones sueltas. Etiquetas personales dispersas no
hacen pueblo, porque cada una significa algo distinto para cada quien. Para que
haya pueblo hace falta un **suelo común**, y con§tel lo ofrece en dos capas:

- **Textos comunes.** Todos leen y anotan sobre el mismo cuerpo de textos.
  El estudio original partió de los 28 textos fundamentales de Amereida, la
  vértebra de la Escuela. Esa visión le da a la comunidad *«a solid ground
  for dialogue»*, como dice *Con§tel: Sharing Marginalia*. En Casiopea ese
  cuerpo es la wiki misma: la [Biblioteca Con§tel](https://wiki.ead.pucv.cl/Biblioteca_Con%C2%A7tel)
  reúne los *Textos Fundamentales* y las *Publicaciones de Apertura*. Por
  eso, como dice la página del proyecto, «Casiopea es un intento de Con§tel».
- **Un léxico común.** Los conceptos no son etiquetas privadas. Cada concepto
  es uno solo para todos, y cada lector lo encuentra ya nombrado por otros
  cuando lo asigna. Sobre ese léxico compartido las lecturas convergen y los
  conceptos se vuelven, a fuerza de conversación, referencias comunes.

El suelo común no borra la diferencia. Cada sección es de su lector, y cada
tema con su desarrollo es la lectura propia de quien lo escribe. Cuando dos
lectores marcan pasajes que se solapan, el mapa muestra que se encontraron,
pero no funde sus conceptos: cada uno leyó a su manera. El pueblo aparece como
figura de muchas lecturas singulares sobre un suelo compartido.

## Los gestos del lector

Como en el scriptorium de los glosadores, el lector hace tres cosas sobre el
texto:

| Gesto | Signo | En la extensión |
|---|---|---|
| Distinguir un pasaje | **§** | Al seleccionar texto aparece **§**, y el pasaje se vuelve una *sección* anclada a la página. |
| Titularlo | **[a]** | Se le asignan conceptos del léxico común. El **[a]**, de *ancla*, *p[a]labra* o *nombre*, es la unidad del mapa. |
| Anotarlo | **[n]** | Se le agrega una *glosa*, que es opcional. |

Después, cada lector agrupa sus conceptos en **temas** y escribe el
**desarrollo** de cada tema: el paso de la marginalia al texto propio.

## El mapa: la figura de todos

`Especial:Constelación` reúne los conceptos de todos los lectores en un mapa.
El mapa no es obra de un solo autor. Es la imagen que refleja el estado actual
del diálogo y ayuda a cada uno a ubicar su aporte entre los de sus pares.

- **Tres grados de proximidad** unen los conceptos: la *misma sección*, el
  *traslape* entre secciones de lectores distintos y el *mismo texto*. Cada
  grado tiene su propia fuerza (0–100 %), y en 0 no se dibuja.
- **Vista 2D (por defecto) o 3D.** En 2D los rótulos nunca se pisan y cada
  concepto se arrastra con el mapa reaccionando en vivo: sus aristas tiran
  de los vecinos y los rótulos se empujan. El concepto elegido pasa a ser el
  centro del mapa, y en 3D «Girar solo» orbita en torno a él.
- **Pantalla completa.** El mapa (*ante*) y el panel de lectura (*dentro*)
  se reparten la pantalla, y la división entre ambos se arrastra.
- **Filtros** por lectores y por páginas, y una **lente** para leer los temas
  de uno o varios lectores. El mapa se exporta como SVG.

En cada página, el menú de usuario ofrece la lectura en tres posiciones:
**−** sin marcas, **§** solo las propias, **§\*** las de todos.
`Especial:MiConstel` reúne la lectura propia y la exporta.

Estado: **versión 0.7.0**. Extensión para MediaWiki 1.43 LTS. La GUI se
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
