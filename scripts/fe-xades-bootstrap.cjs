"use strict";

const path = require("path");
const { DOMImplementation, DOMParser, XMLSerializer } = require("@xmldom/xmldom");
const xpath = require("xpath");
const xadesjs = require("xadesjs");
const xmldsigjs = require("xmldsigjs");

let initialized = false;

function registerXmlCore(deps, pkgName) {
  try {
    const pkgRoot = path.dirname(require.resolve(`${pkgName}/package.json`));
    const utils = require(path.join(pkgRoot, "node_modules/xml-core/build/cjs/utils.js"));
    if (typeof utils.setNodeDependencies === "function") {
      utils.setNodeDependencies(deps);
    }
  } catch {
    // Copia anidada no presente; xadesjs.setNodeDependencies puede ser suficiente.
  }
}

function ensureFeXadesBootstrap() {
  if (initialized) return;

  const deps = {
    DOMParser,
    XMLSerializer,
    DOMImplementation,
    xpath,
  };

  xadesjs.setNodeDependencies(deps);
  registerXmlCore(deps, "xmldsigjs");
  registerXmlCore(deps, "xadesjs");

  xmldsigjs.Application.setEngine("NodeJS", globalThis.crypto);
  xadesjs.Application.setEngine("NodeJS", globalThis.crypto);

  initialized = true;
}

module.exports = { ensureFeXadesBootstrap };
