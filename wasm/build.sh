#!/bin/sh
# Compile le solveur (fluid.c) en WebAssembly et l'embarque en base64 dans
# js/fluid.wasm.js. Le module est embarqué — et non chargé par fetch() —
# pour que le jeu continue de s'ouvrir sans serveur (file://).
#
# Prérequis : clang avec la cible wasm32 (wasm-ld), node.
# Usage : sh wasm/build.sh
set -e
cd "$(dirname "$0")"

clang --target=wasm32 -O3 -nostdlib -fno-builtin \
  -Wall -Wextra \
  -Wl,--no-entry \
  -o fluid.wasm fluid.c

node - <<'EOF'
const fs = require("fs");
const b64 = fs.readFileSync("fluid.wasm").toString("base64");
const lines = b64.match(/.{1,100}/g).join("\" +\n  \"");
fs.writeFileSync("../js/fluid.wasm.js",
  '"use strict";\n\n' +
  "// Généré par wasm/build.sh — ne pas éditer à la main.\n" +
  "// Module WebAssembly du solveur PBF (wasm/fluid.c), embarqué en base64\n" +
  "// pour que le jeu s'ouvre toujours sans serveur ni requête réseau.\n" +
  'const FLUID_WASM_B64 =\n  "' + lines + '";\n');
console.log("js/fluid.wasm.js écrit (" + b64.length + " caractères base64)");
EOF
