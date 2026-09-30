# El mapa de constelación

`Especial:Constelación` dibuja los conceptos ([a]) de los lectores como un
grafo: cada concepto es un rótulo y cada relación entre dos conceptos es una
arista. Este documento explica **cómo se calculan las posiciones** (y por lo
tanto las distancias) en 2D y 3D, y **qué hace cada control de fuerza**.
El código está en `resources/ext.constel.map/graph.js` (layout y dibujo) y
`map.js` (barra de herramientas); los datos, en `src/Map/GraphBuilder.php`.

El spec (`specs/casiopea-constel.allium`, `ConceptMap`) fija qué se expone
(`ProximityDegreesAreParametric`, `FrequencyScaling`, `LabelsNeverOverlapIn2D`);
los números de abajo son decisiones de diseño y pueden ajustarse.

## 1. Los datos: nodos y aristas

`GraphBuilder` arma el grafo con los §§ visibles según los filtros (lectores,
páginas):

- **Nodo** = un concepto con al menos un §. Su rótulo mide entre 13 y 33 px:
  `11 + 20 · (0.6 · §§/máx§§ + 0.4 · páginas/máxpáginas)` (como constel).
  Al acercar o alejar, la letra en pantalla se acota a 13–40 px y crece más
  lento que el mapa (`FONT_MIN_PX`, `FONT_MAX_PX`, `FONT_GROWTH`).
- **Aristas**, en tres grados de proximidad. Cada par de conceptos puede tener
  hasta tres aristas, una por grado, y cada una tiene un **peso** entero:

| Grado | Clave | Cuándo | Peso |
|---|---|---|---|
| Misma sección | `co_excerpt` | los dos conceptos titulan el mismo § | nº de §§ que comparten |
| Traslape | `overlap` | §§ anclados de lectores distintos, en la misma página, cuyos rangos comparten al menos un carácter | nº de pares de §§ traslapados |
| Mismo texto | `co_page` | los dos conceptos aparecen en la misma página | nº de páginas compartidas |

El traslape es sólo una relación: nunca identifica ni fusiona conceptos
(`OverlapNeverConverges`).

## 2. Cómo se calculan las posiciones

2D y 3D usan el **mismo layout de fuerzas** (`layout()`), del tipo
Fruchterman-Reingold, en tres coordenadas; en 2D la `z` se fija en 0. Con `n`
conceptos se define un espaciado ideal

    k = 600 / √n        (unidades del layout)

y en cada iteración cada concepto acumula:

1. **Repulsión** con *todos* los demás: magnitud `k² / d` (d = distancia).
2. **Resorte** por cada arista activa, que atrae a sus dos extremos:
   magnitud `d² / k · log₂(1 + peso) · fuerza(grado)`.
3. **Gravedad** al centro: `−1.5 · posición` (`GRAVITY`). Mantiene el área
   del mapa del orden de `n · k²`.
4. **Atracción al centroide de su tema** (si pertenece a uno de la lente):
   `0.15 · (centroide − posición)`.

El paso de cada concepto se limita por una **temperatura** que empieza en
`2k` y baja un 3 % por iteración (300 iteraciones). Las posiciones iniciales
son una espiral de Fibonacci: el mismo mapa cae igual cada vez.

### Largo de una arista

Si se mira un solo resorte contra la repulsión de sus extremos, el equilibrio
está donde `d² / k · w · f = k² / d`, es decir

    d ≈ k · (w · f)^(−1/3)      con w = log₂(1 + peso), f = fuerza (0–1)

| Peso | f = 100 % | 60 % | 35 % | 5 % |
|---|---|---|---|---|
| 1 | 1,00 k | 1,19 k | 1,42 k | 2,71 k |
| 3 | 0,79 k | 0,94 k | 1,13 k | 2,15 k |
| 7 | 0,69 k | 0,82 k | 0,98 k | 1,88 k |

Es una aproximación: cada concepto siente además la repulsión de todos, la
gravedad, su tema y sus otras aristas. Pero dice lo esencial: **más peso,
más cerca; menos fuerza, más lejos**, y la fuerza actúa con raíz cúbica (bajar
de 100 % a 35 % alarga la arista ~1,4 veces, no 3).

### 2D: distancias medidas en rótulos

En 2D la escala del layout **no se normaliza**: se ancla al tamaño de los
rótulos. `k` pasa a valer `EDGE_IN_LABELS = 1.3` veces el ancho medio de un
rótulo (medido con la tipografía real, más su margen `PAD`). Así, una arista
de peso 1 con fuerza 100 % mide del orden de 1,3 rótulos, y bajar una fuerza
**abre** de verdad a sus conceptos respecto de las letras.

Después vienen dos pasos que sólo existen en 2D:

1. **Choques** (`separate()`): cada rótulo ocupa su caja de tinta más 3 px
   por lado; los pares que se pisan se apartan por el eje de menor traslape.
   Si una zona densa no cede, el mapa entero se abre un 15 % y se reintenta,
   hasta que nada se toque.
2. **Encuadre**: el mapa se centra y el zoom inicial es el que lo encuadra
   (`min(1, 0.96·ancho/extensión, 0.96·alto/extensión)`). Si a ese zoom una
   letra quedaría bajo 11 px en pantalla, su caja se reserva ya de ese
   tamaño antes de separar, así que a ese zoom o más nada se pisa.

Los conceptos **fijados a mano** (arrastrados) no se mueven en el layout: el
resto se acomoda a ellos.

### 3D: distancias relativas, en una esfera

En 3D el layout termina **normalizado**: se lleva el centroide al origen y
todo se escala para que el concepto más lejano quede a `RADIUS = 210`
unidades. Las distancias son entonces **relativas**: al bajar una fuerza sus
conceptos se abren respecto de los demás, pero el mapa no crece, se
redistribuye dentro de la misma esfera.

La proyección es en perspectiva, con la cámara a `CAMERA = 900`: cada punto
se escala por `900 / (900 − z)` tras rotarlo (yaw, pitch). La letra sigue esa
escala y lo lejano se atenúa (opacidad de 0,45 a 1 según la profundidad).
Los rótulos pueden cruzarse en 3D; la garantía de no traslape es sólo de 2D.

### Rótulos apagables y círculos

La barra tiene dos filas: la primera dice **cómo se ve** (vista 2D/3D, «Girar
solo», aristas, conceptos, proximidad, zoom) y la segunda **qué se ve** (lectores,
páginas, lente y, con varios lectores, qué conceptos). Un interruptor explícito
**Palabras ⇄ Nodos** elige cómo se dibujan los conceptos, y con nodos una casilla
«Rotular los principales» (apagada por omisión) deja la palabra de los
`map_main_labels` (12) más frecuentes, a lo más la cuarta parte del mapa (`graph.draw` recibe `labels`: `all` = palabras, `main` = nodos con
principales, `none` = nodos sin rótulos). La vista por omisión es 2D con palabras,
sea cual sea el tamaño del mapa (los topes de carga lo protegen); la elección se
recuerda por navegador (`concepts` y `lead` en `constel-map`). Los controles de
la fila «cómo se ve» se nombran con íconos Lucide (tooltip y nombre accesible).

**Tamaño de la letra.** Es el mismo en 2D y en 3D (`fontUnits`): al encuadre mide
`max(13, tamaño · fit · ppu)` px, o sea lo que reservaron las cajas (de 13 a 33
según la frecuencia), y el zoom la multiplica por `(zoom/fit)^0,5`, con el
resultado acotado entre 13 y 40 px. Antes el 2D escalaba la letra con el zoom de
encuadre (aplastada contra el piso en mapas densos) y el 3D partía sin encuadre
con zoom 1, así que salía más grande; y como la letra crecía desde el tamaño
natural, que en mapas densos queda bajo el piso, acercar no la cambiaba. Ahora
el 3D se encuadra (`fit` deja la esfera entera en el lienzo) y la letra crece
desde lo que se ve. El concepto elegido va en negrita, igual en ambas vistas.

- **Círculos.** Un concepto sin rótulo es un `<circle>` del color de su tema
  con **área proporcional a su frecuencia** (la misma `0.6 · §§ + 0.4 · páginas`
  del rótulo). En pantalla mide `DOT_MIN_PX · (1 + (DOT_MAX_PX/DOT_MIN_PX − 1) ·
  √frecuencia)` píxeles de radio al zoom de encuadre (3 a 15,6) y crece al acercar
  como la letra (`FONT_GROWTH`). El círculo es lo que se apunta, lo que recibe
  el foco y lo que se arrastra; el texto sólo aparece al revelarlo.
- **Cajas de choque.** En 2D la caja de un círculo es un cuadrado de su radio
  más `PAD`, pero dos círculos chocan como círculos (distancia entre centros ≥
  suma de radios más `2·PAD`, como entre dos cajas de texto), y reserva el mismo suelo que las letras (un círculo nunca baja de
  `DOT_MIN_PX` al zoom de encuadre). La escala del layout (`EDGE_IN_LABELS`) se
  ancla al ancho medio de las cajas, que con círculos es mucho menor: el mapa
  se compacta.
- **Aristas.** Se dibujan igual con nodos que con palabras, en una capa debajo de
  ellos (enlaces, luego círculos, luego textos). Al apuntar o elegir un concepto
  sus vecinos quedan resaltados. Con más aristas que `ConstelMapMaxDrawnLinks` se
  dibujan las más fuertes (por fuerza del grado y `log2(1 + peso)`) hasta ese
  tope y, además, todas las del concepto apuntado o elegido (`adjacency`). Donde no se puede apuntar
  (`hover: none`: teléfono, tableta) el primer toque revela y el segundo elige;
  con mouse, o una pantalla táctil que también apunta, un clic elige directo.
- **Medición** (`Especial:Constelación`, 1 006 conceptos, todos los lectores;
  posiciones de los conceptos a zoom de encuadre, en unidades del lienzo):

| Rótulos | Ancho × alto | Alto/ancho | Extensión (√área) |
|---|---|---|---|
| Todos | 1 979 × 3 461 | 1,75 | 2 617 |
| Nodos con los principales rotulados | 1 014 × 854 | 0,84 | 931 |

  Con todos los rótulos, 703 de los 1 006 quedan en columnas de cinco o más
  con la misma `x` (57 columnas, la mayor de 42): eso es lo que el modo con
  círculos evita. Con 1 006 letras de 11 px como mínimo el mapa no cabe en la
  pantalla, y cada pasada de `settle()` reserva cajas más grandes, así que la
  densidad de fondo la resuelve mejor el modo con círculos.
- **Choque por la línea de centros: descartado.** Se probó empujar cada par por
  la línea que une sus centros, en vez de por el eje de menor traslape. Quitaba
  las columnas (55 rótulos en columnas de cinco o más) pero abría el mapa en una
  franja ancha y baja (6 373 × 551, alto/ancho 0,09): una caja de rótulo es seis
  veces más ancha que alta, y un montón denso que se abre se ensancha en esa
  proporción. Estirar en vertical antes del choque, o debilitar la gravedad
  vertical, no cambiaron la proporción, y inclinar el empuje hacia la vertical
  hizo que `separate()` dejara de converger. Se conserva el choque por el eje de
  menor traslape.

### Límites de carga

El mapa está pensado para lecturas colectivas muy grandes, así que cada costo
tiene un tope (`MapHasLoadLimits`), con un valor por omisión que se ajusta en la
configuración, y un aviso cuando el tope actúa. El aviso es una sobreposición
sobre el mapa (no ocupa lugar en el diseño), con un botón para cerrarlo, que se
apaga solo a los 12 s (`NOTICE_MS`); lo cerrado o vencido no vuelve a salir
mientras el texto sea el mismo.

| Qué | Tope (por omisión) | Qué pasa al pasarlo |
|---|---|---|
| Conceptos por respuesta | `ConstelMapMaxNodes` (2 000) | el servidor entrega los más frecuentes, con sus conteos completos, y calcula las aristas sólo entre ellos; el aviso dice «los N más frecuentes de M» |
| Palabras | `ConstelMapMaxLabels` (300) | como palabras, las 300 más frecuentes llevan su palabra y el resto son nodos |
| Aristas dibujadas | `ConstelMapMaxDrawnLinks` (6 000) | se dibujan las más fuertes hasta el tope y las del concepto apuntado o elegido; si al subir una fuerza se pasa del tope, el mapa se redibuja así |
| Lectores en el filtro | 8 (`MAX_READERS`, uno por color) | el campo se apaga («Máximo: 8») |

El trazado también está acotado. La repulsión del layout de fuerzas compara todos
los conceptos entre sí, así que sus iteraciones bajan cuando hay muchos
(`LAYOUT_BUDGET`, 3·10⁸ pares en total, con un mínimo de 60; hasta ~1 000
conceptos siguen siendo 300) y la temperatura baja más rápido para llegar igual
al equilibrio. El choque de cajas (`collide`) ordena por borde izquierdo y sólo
compara las que se cruzan en x, no todas con todas.

Medición con los 1 006 conceptos de la prueba de carga (redibujar al cambiar el
control de rótulos, navegador de pruebas): sin tope de rótulos y con todas las
aristas, más de 15 s; con los topes, entre 2,5 y 3,7 s (layout 1,3 s, `settle`
0,8 s, DOM 0,1 s).

### Varios lectores

Con dos o más lectores en «Secciones de», el servidor agrega a cada nodo
`readers` (usuario → cantidad de §§, sólo de los lectores filtrados; los ocultos
para quien mira no se nombran, pero su aporte sigue en `excerpts`). El cliente:

- **Color por lector.** El texto del concepto (o su círculo) se pinta con el color
  del lector que lo aporta; si lo aportan varios, con un degradado de tramos
  parejos al borde, de largo proporcional al aporte de cada uno (un
  `linearGradient` por composición distinta). Cada lector parte con el color de
  su lugar en el filtro (los colores de categoría de los temas) y se cambia con
  un `input type=color` dentro de un círculo de 1,15 rem en su píldora, que
  hace de leyenda; la elección se recuerda por navegador (`readerColors`).
- **Filtro de conceptos.** Un selector en la fila de filtros: todos, sólo los
  compartidos (dos o más lectores aportan al concepto) o sólo los propios (uno
  solo). Se calcula en el cliente sobre `readers` y deja
  las aristas entre los conceptos que quedan; al subir una fuerza desde 0 con el
  mapa filtrado, se piden los grados que faltan y se redibuja.
- **Fuerzas iniciales.** Sin fuerzas guardadas por quien mira, el mapa parte con
  traslape al 100 % y mismo texto en 0 % (`autoForces`); con un solo lector
  vuelven las de siempre.
- **Lado a lado (fase posterior).** `graph.draw` no guarda estado fuera de su
  contenedor y `map.js` concentra el estado en un objeto, de modo que dos
  paneles con el mismo trazado se arman con dos llamadas; falta la
  sincronización de posiciones y de selección entre ambos.

### Vista de anillos

Con un concepto elegido, el botón «Ver anillos» del panel reemplaza el lienzo
por su vista egocéntrica (`rings.js`; se vuelve con «Volver al mapa», que
conserva la selección). Los tres anillos son los tres grados de proximidad, del
más fuerte al más débil: misma sección (radio 115), traslape (215) y mismo
texto (315), con cupos de 8, 16 y 24 vecinos (`RING_RADII`, `RING_QUOTAS`).

- **Anillo de cada vecino.** El del grado más fuerte que lo une al concepto
  del centro; a igual grado, el de mayor peso.
- **Cupo y «+N más».** Cada anillo muestra los vecinos de mayor peso hasta su
  cupo; el resto va en la lista alternativa de abajo, que un «+N más» abre.
- **Orden angular.** Seriación voraz: se parte del vecino de mayor peso y se
  agrega, cada vez, el más próximo al último (suma de `log2(1 + peso)` de todos
  los grados entre ambos), así los vecinos próximos entre sí quedan contiguos.
  Cada anillo parte de un ángulo distinto para que los rótulos no queden
  alineados en radio.
- **Rótulos.** Todos visibles, fuera del círculo y sobre el radio (a la
  derecha o izquierda según el lado). Los círculos tienen el color del tema y
  área según la frecuencia, como el modo sin rótulos.
- **Cambiar de centro.** Elegir un vecino lo lleva al centro deslizando los
  círculos (450 ms; sin animación con `prefers-reduced-motion`) y actualiza el
  panel de detalle. Los datos vienen de una lectura aparte con los tres grados
  (`cgkinds`), cacheada en el servidor, independiente de las fuerzas.

### 3D: separación y niebla

En 3D la esfera del layout crece con la cantidad de conceptos
(`sphereRadius`: `RADIUS · √(n/60)`, entre 1 y 3 veces `RADIUS`) y su escala la
fija el percentil 92 de las distancias, no el máximo, para que un concepto
lejano no apriete al resto contra el centro. La **niebla** (`fog`) da a cada
concepto una opacidad de 0,08 (lo más lejano) a 1 (lo más cercano), con una
curva cuadrática: lo del fondo se apaga rápido y hace de telón. La letra ya
encogía con la perspectiva.

## 3. Los controles de fuerza

La barra tiene un control por grado. Todos van de **0 a 100 %, en pasos de
5 %**; internamente la fuerza es `valor / 100` (0–1).

| Control | Grado | Por omisión | Opacidad base de su arista |
|---|---|---|---|
| ≡ (misma sección) | `co_excerpt` | 100 % | 0,85 |
| capas (traslape) | `overlap` | 60 % | 0,60 |
| hoja (mismo texto) | `co_page` | 35 % | 0,40 |

Los valores por omisión expresan una jerarquía: la misma sección es una
decisión explícita de un lector; el traslape, un cruce entre lectores; el
mismo texto, la relación más débil. La fuerza elegida **se recuerda por
navegador** (`mw.storage`, clave `constel-map`, campo `forces`).

Cada control afecta a su grado en cuatro cosas:

1. **Atracción en el layout**: multiplica el resorte de sus aristas
   (ver la tabla del largo de arista).
2. **Visibilidad de la arista**: opacidad = `base · (0.4 + 0.6 · fuerza)`.
   A 100 % la arista tiene su opacidad base; a 5 %, el 43 % de ella.
   El grosor no depende de la fuerza sino del peso:
   `min(5, 1 + log₂(1 + peso))` px (las de `co_page`, siempre 1 px).
3. **En 0 el grado desaparece**: sus aristas no se dibujan, no atraen y no
   figuran en la lista accesible («Ver como lista»).
4. **Al arrastrar un concepto (2D)**: la simulación en vivo usa la misma
   fuerza para la rigidez de cada resorte.

### Recalcular mientras se arrastra el control

Hasta la 0.8.0 el mapa se recalculaba **al soltar** el control (`change`),
desde cero: se borraban las posiciones, se volvía a la espiral inicial y se
redibujaba todo el SVG. Como un layout de fuerzas tiene muchos equilibrios
posibles, dos fuerzas vecinas podían dar mapas muy distintos, y el cambio
llegaba de golpe: el mapa saltaba.

Ahora el mapa **sigue al control mientras se arrastra** (`input`):

- `map.js` pide a lo más **un recálculo por cuadro** (`requestAnimationFrame`),
  con el último valor; al soltar sólo se recuerda la preferencia y se
  actualiza la lista accesible.
- `graph.setForces()` rehace el layout **en tibio** sin redibujar el SVG:
  parte del equilibrio anterior (en 3D, el de antes de normalizar) con
  temperatura `0.2k` (`WARM_TEMPERATURE`) y 120 iteraciones (`WARM_STEPS`),
  en vez de `2k` y 300. Un cambio chico de fuerza mueve poco el mapa, pero
  arrastrar hasta el final llega al mismo grado de apertura que el cálculo
  en frío.
- Los conceptos **se deslizan** a su lugar nuevo (un 25 % del camino por
  cuadro, `GLIDE`); si el mapa estaba encuadrado, el zoom sigue al encuadre
  nuevo; si no, se respeta el de quien mira. El concepto elegido sigue al
  centro. Con `prefers-reduced-motion`, llegan sin deslizarse.
- Las aristas de un grado que baja a 0 se retiran del lienzo y vuelven al
  subirlo, sin redibujar.

Medido con los datos locales (18 conceptos, 63 aristas), barriendo cada
fuerza de 100 % a 0 % en pasos de 5 %: el cambio típico entre dos pasos
bajó de ~25 % del ancho del lienzo (en frío) a ~3–7 % en 2D, y de ~7 % a
~0,5–1,5 % en 3D. Recalcular cuesta ~2 ms por paso; un layout completo, del
orden de 25 ms con 150 conceptos y 85 ms con 300.

Consecuencia a tener en cuenta: el mapa al que se llega arrastrando depende
del camino, y al recargar la página el layout se calcula en frío con las
fuerzas guardadas, así que puede no ser idéntico (la apertura relativa sí es
la misma).

## 4. Constantes

| Constante | Valor | Dónde actúa |
|---|---|---|
| `k` | `600 / √n` | espaciado ideal del layout |
| `GRAVITY` | 1,5 | atracción al centro |
| atracción al tema | 0,15 | hacia el centroide del tema |
| `EDGE_IN_LABELS` | 1,3 | 2D: `k` en anchos medios de rótulo |
| `PAD` | 3 px | 2D: margen de la caja de cada rótulo |
| `RADIUS` | 210 | 3D: radio de la esfera normalizada |
| `CAMERA` | 900 | 3D: distancia de la cámara |
| `FORCES` | 1 / 0,6 / 0,35 | fuerza por omisión de cada grado |
| `OPACITY` | 0,85 / 0,6 / 0,4 | opacidad base de cada grado |
| `WARM_TEMPERATURE` | 0,2 | temperatura inicial del recálculo en vivo (× k) |
| `WARM_STEPS` | 120 | iteraciones del recálculo en vivo |
| `GLIDE` | 0,25 | fracción del camino por cuadro al deslizarse |
