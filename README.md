# Casiopea-Con§tel

**con§tel** en MediaWiki: la aplicación a [Casiopea](https://wiki.ead.pucv.cl)
de [con§tel](https://github.com/hspencer/constel), la herramienta de lectura
activa y análisis temático de la e[ad] PUCV.

Al seleccionar un texto de una página aparece **§**. Con él el lector crea una
**sección** y le asigna conceptos de un vocabulario compartido, más una glosa
opcional. Después agrupa esos conceptos en temas personales y escribe notas de
desarrollo. La página especial *Constelación* reúne los conceptos de todos los
lectores en un mapa 3D: los conceptos quedan unidos cuando están en una misma
sección, cuando secciones de lectores distintos se solapan y cuando se anotaron
en la misma página.

Estado: **versión 0.3.0**. Extensión para
MediaWiki 1.43 LTS. La GUI se diseña sobre los tokens de
[Stella Nova](https://github.com/hspencer/stella-nova) y funciona con cualquier skin.

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
