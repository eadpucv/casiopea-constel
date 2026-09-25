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

- **Nodo** = un concepto con al menos un §. Su rótulo mide entre 11 y 31 px:
  `11 + 20 · (0.6 · §§/máx§§ + 0.4 · páginas/máxpáginas)` (como constel).
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
   (`min(1, 0.96·ancho/extensión, 0.96·alto/extensión)`). El zoom escala
   posiciones y letras por igual, así que no reabre traslapes.

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
