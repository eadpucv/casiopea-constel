# casiopea-constel

**con§tel** en MediaWiki: la aplicación a [Casiopea](https://wiki.ead.pucv.cl)
de [con§tel](https://github.com/hspencer/constel), la herramienta de lectura
activa y análisis temático de la e[ad] PUCV.

Al seleccionar un pasaje de una página aparece **§**. Con él el lector crea un
*excerpt* y le asigna conceptos de un vocabulario compartido. Después agrupa
esos conceptos en temas personales y escribe notas de desarrollo. La página
especial *Constelación* reúne los conceptos de todos los lectores en un mapa.
Ahí los conceptos quedan unidos cuando están en un mismo § y cuando los §§ de
lectores distintos se solapan sobre un pasaje.

Estado: **especificación** (no hay código todavía). Extensión para MediaWiki 1.43 LTS.

## Especificación primero

- [`specs/casiopea-constel.allium`](specs/casiopea-constel.allium): el
  comportamiento. Es la fuente de verdad.

```bash
allium check   specs/casiopea-constel.allium
allium analyse specs/casiopea-constel.allium
```

## Licencia

Artistic License 2.0 (`Artistic-2.0`). Ver [`COPYING`](COPYING).
© 2026 Herbert Spencer González, .:TIG:. e[ad] PUCV, Corporación Cultural Amereida.
