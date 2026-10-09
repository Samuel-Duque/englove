#!/usr/bin/env node
// Verificación estructural de una spec de Englove (skill englove-spec).
//
// Uso:  node .agents/skills/englove-spec/scripts/check-spec.mjs specs/SPEC-NN-nombre.md [--root RUTA]
//
// No duplica la planeación: lee en cada ejecución la plantilla de planning/sdd-process.md §5,
// los pendientes de .agents/CONTEXT.md §15 y las tareas de planning/taskboard.md.
// Sale con código 0 sin errores, 1 con errores y 2 si no puede leer sus insumos.
// La validación semántica (decisiones de §14, fuera de alcance de §2.4) sigue siendo manual:
// ver references/validacion.md.

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

const READING_WORDS_PER_MINUTE = 200;
const MAX_READING_MINUTES = 20; // sdd-process §3
const VAGUE_RESULT = /funciona(?:rá)? (?:correctamente|bien)|como se espera|de (?:forma|manera) (?:adecuada|correcta)/i;

// Términos que casi siempre indican un error fuera de las secciones de exclusiones.
const RED_FLAGS = [
  [/\bGuardian\b/, 'no existe la entidad Guardian; solo Student.guardian_name y guardian_contact', 'decisión 35'],
  [/Consent(Record|Status|Method)|consentimiento/i, 'ningún módulo ni campo de consentimiento legal de menores', 'decisión 36, CONTEXT §9'],
  [/Supabase\s+(Storage|Auth|Realtime)|\bRLS\b/, 'Supabase solo como Postgres; los archivos van a Cloudflare R2', 'decisiones 1 y 55, CONTEXT §6'],
  [/WebSocket|socket\.io|Server-Sent Events|\bSSE\b/i, 'sin tiempo real en el piloto; polling cada 30 s', 'CONTEXT §2.4, decisión 9'],
  [/heartbeat/i, 'sin heartbeat; solo inicio y fin de cada actividad', 'CONTEXT §2.4, decisión 10'],
  [/\bPhaser\b/, 'Phaser es Fase 2; los microjuegos van en React puro', 'CONTEXT §2.4, decisión 17'],
  [/iframe/i, 'Educaplay solo como enlace externo, sin iframe', 'CONTEXT §2.4, decisión 17'],
  [/Capacitor|App Store|Google Play/, 'sin empaquetado móvil ni tiendas en el piloto', 'CONTEXT §2.4, decisión 12'],
  [/pasarela de pago|Wompi|ePayco|Stripe/i, 'sin pagos en el piloto', 'CONTEXT §2.4, decisión 2'],
  [/localStorage/, 'los tokens nunca van en localStorage (las respuestas offline usan IndexedDB)', 'CONTEXT §10, architecture §7.5'],
  [/db push/, 'migraciones con Prisma Migrate; nunca db push fuera de local', 'CONTEXT §6'],
  [/flags?\s+`?(stats|leaderboard)\b/i, 'el panel estadístico se controla solo por RBAC', 'decisión 41'],
  [/\brejected\b/, 'ApprovalStatus no tiene rejected; rechazar borra la solicitud', 'decisión 77'],
  [/Student\.name\b/, 'el nombre vive en User.name', 'decisión 79'],
  [/Review\.(score|graded_at)\b/, 'la nota vive solo en Attempt.score y Attempt.graded_at', 'decisión 72'],
  [/max_attempts/, 'un intento por asignación más habilitación; no existe max_attempts', 'decisión 25'],
  [/extendUntil/, 'el plazo del nuevo intento es Attempt.retry_extend_until', 'decisión 61'],
  [/tipos? de ítem|cuatro tipos/i, 'terminología: cinco tipos de actividad y cinco mecánicas de juego', 'decisión 66'],
];

const errors = [];
const warnings = [];
const error = (where, msg) => errors.push(`[${where}] ${msg}`);
const warn = (where, msg) => warnings.push(`[${where}] ${msg}`);

function fatal(msg) {
  console.error(`check-spec: ${msg}`);
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { spec: null, root: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log('Uso: node check-spec.mjs specs/SPEC-NN-nombre.md [--root RUTA_DEL_REPO]');
      process.exit(0);
    } else if (arg === '--root') {
      opts.root = argv[++i];
    } else if (!opts.spec) {
      opts.spec = arg;
    } else {
      fatal(`argumento inesperado: ${arg}`);
    }
  }
  if (!opts.spec) fatal('falta la ruta de la spec. Uso: node check-spec.mjs specs/SPEC-NN-nombre.md');
  return opts;
}

function readText(path) {
  return readFileSync(path, 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

function findRoot(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.agents', 'CONTEXT.md')) && existsSync(join(dir, 'planning', 'sdd-process.md'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Texto de una sección "## N. ..." hasta la siguiente "## " que no esté dentro de un bloque ```.
function sliceH2(md, number) {
  const lines = md.split('\n');
  const masked = maskFences(lines);
  const start = masked.findIndex((l) => new RegExp(`^## ${number}\\.\\s`).test(l));
  if (start === -1) return null;
  let end = masked.findIndex((l, i) => i > start && /^## /.test(l));
  if (end === -1) end = lines.length;
  return lines.slice(start + 1, end).join('\n');
}

function tableCells(line) {
  const t = line.trim();
  if (!t.startsWith('|') || !t.endsWith('|') || t.length < 2) return null;
  return t.slice(1, -1).split('|').map((c) => c.trim());
}

const isSeparatorRow = (cells) => cells.every((c) => /^:?-+:?$/.test(c));

// Copia de las líneas con el contenido de los bloques ``` vaciado, para no confundir encabezados.
function maskFences(lines) {
  let inFence = false;
  return lines.map((l) => {
    if (/^\s*(```|~~~)/.test(l)) {
      inFence = !inFence;
      return '';
    }
    return inFence ? '' : l;
  });
}

function parseTemplate(sdd) {
  const sec5 = sliceH2(sdd, 5);
  if (!sec5) fatal('no se encontró "## 5." en planning/sdd-process.md');
  const block = sec5.match(/```markdown\n([\s\S]*?)\n```/);
  if (!block) fatal('no se encontró el bloque de plantilla en planning/sdd-process.md §5');
  const text = block[1];
  const sections = [...text.matchAll(/^## (\d+)\. (.+)$/gm)].map((m) => ({ n: Number(m[1]), title: m[2].trim() }));
  const header = [];
  let states = [];
  for (const line of text.split('\n')) {
    const cells = tableCells(line);
    if (!cells || cells.length !== 2 || isSeparatorRow(cells) || cells[0] === 'Campo') continue;
    header.push({ field: cells[0], value: cells[1] });
    if (cells[0] === 'Estado') states = cells[1].split('/').map((s) => s.trim()).filter(Boolean);
  }
  const placeholders = [...new Set(text.match(/<[^<>\n]+>/g) || [])];
  const guidance = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 10 && !l.startsWith('#') && !l.startsWith('|'));
  if (sections.length === 0 || header.length === 0 || states.length === 0) {
    fatal('la plantilla de sdd-process §5 no tiene el formato esperado (secciones, cabecera o estados)');
  }
  return { sections, header, states, placeholders, guidance };
}

// P-n → specs que deben cerrarlo, según la tabla de CONTEXT §15.
function parsePendings(context) {
  const sec15 = sliceH2(context, 15);
  if (!sec15) fatal('no se encontró "## 15." en .agents/CONTEXT.md');
  const pendings = new Map();
  for (const line of sec15.split('\n')) {
    const cells = tableCells(line);
    if (!cells || !/^P-\d+$/.test(cells[0])) continue;
    pendings.set(cells[0], cells[cells.length - 1].match(/SPEC-\d{2}[a-z]?/g) || []);
  }
  return pendings;
}

function parseTaskboard(taskboard) {
  const ids = new Set();
  const bySpec = new Map();
  for (const line of taskboard.split('\n')) {
    const cells = tableCells(line);
    if (!cells || !/^(ENG-\d{3}|SPEC-\d{2}[a-z]?|DOC-\d{2})$/.test(cells[0])) continue;
    ids.add(cells[0]);
    if (cells[0].startsWith('ENG-') && cells.length >= 3) {
      const spec = cells[cells.length - 2];
      if (!bySpec.has(spec)) bySpec.set(spec, []);
      bySpec.get(spec).push(cells[0]);
    }
  }
  return { ids, bySpec };
}

// Identificadores citados en un texto, expandiendo rangos como "ENG-010 a ENG-019" (campo Tareas).
// `pad` es el ancho con ceros; `known` limita los rangos a identificadores que existen.
function expandIds(text, prefix, pad, known) {
  const digits = pad ? `\\d{${pad}}` : '\\d+';
  const found = new Set(text.match(new RegExp(`\\b${prefix}-${digits}\\b`, 'g')) || []);
  const range = new RegExp(`\\b${prefix}-(${digits})\\s*(?:a|–|—|…|\\.\\.\\.|-)\\s*${prefix}-(${digits})\\b`, 'g');
  for (const m of text.matchAll(range)) {
    for (let n = Number(m[1]); n <= Number(m[2]); n++) {
      const id = `${prefix}-${String(n).padStart(pad, '0')}`;
      if (!known || known.has(id)) found.add(id);
    }
  }
  return found;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const specPath = resolve(opts.spec);
  if (!existsSync(specPath)) fatal(`no existe ${opts.spec}`);
  const root = opts.root ? resolve(opts.root) : findRoot(dirname(specPath)) || findRoot(process.cwd());
  if (!root) fatal('no se encontró la raíz del repositorio (.agents/CONTEXT.md); usa --root');

  const template = parseTemplate(readText(join(root, 'planning', 'sdd-process.md')));
  const pendings = parsePendings(readText(join(root, '.agents', 'CONTEXT.md')));
  const taskboardPath = join(root, 'planning', 'taskboard.md');
  const taskboard = existsSync(taskboardPath) ? parseTaskboard(readText(taskboardPath)) : null;

  const spec = readText(specPath);
  const lines = spec.split('\n');
  const masked = maskFences(lines);
  const findSection = (re) => template.sections.find((s) => re.test(s.title))?.n;
  const N = {
    scope: findSection(/^alcance$/i),
    rf: findSection(/requisitos funcionales/i),
    tests: findSection(/pruebas/i),
    outOfScope: findSection(/fuera de alcance/i),
    questions: findSection(/preguntas abiertas/i),
    changelog: findSection(/registro de cambios/i),
  };

  // Nombre de archivo y título.
  const file = basename(specPath);
  const fileMatch = file.match(/^(SPEC-\d{2}[a-z]?)-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/);
  if (!fileMatch) error('archivo', `"${file}" no sigue SPEC-NN-nombre-en-kebab-case.md (sdd-process §4: minúsculas, sin tildes)`);
  if (basename(dirname(specPath)) !== 'specs') warn('archivo', 'la spec no está en la carpeta specs/ (sdd-process §4)');

  const h1Index = masked.findIndex((l) => /^# /.test(l));
  const h1 = h1Index === -1 ? null : masked[h1Index].match(/^# (SPEC-\d{2}[a-z]?)\s+([—–-])\s+(.+)$/);
  if (!h1) error('título', 'falta el título "# SPEC-NN — Título de la capacidad"');
  else if (h1[2] !== '—') warn('título', 'el título usa un guion; la plantilla usa raya (—)');
  const specId = h1?.[1] || fileMatch?.[1] || null;
  if (h1 && fileMatch && h1[1] !== fileMatch[1]) error('título', `el título dice ${h1[1]} y el archivo ${fileMatch[1]}`);
  const baseId = specId?.replace(/[a-z]$/, '') || null;
  const isSplit = Boolean(specId && specId !== baseId);

  // Secciones "## N. Título".
  const headings = [];
  masked.forEach((l, i) => {
    if (/^## /.test(l)) headings.push({ line: i, text: l.slice(3).trim() });
  });
  const sections = new Map();
  headings.forEach((h, k) => {
    const end = k + 1 < headings.length ? headings[k + 1].line : lines.length;
    const body = lines.slice(h.line + 1, end).join('\n');
    const m = h.text.match(/^(\d+)\.\s+(.+)$/);
    if (!m) {
      warn('estructura', `"## ${h.text}" no es una sección de la plantilla; usa "###" para subsecciones`);
      return;
    }
    const n = Number(m[1]);
    if (sections.has(n)) error('estructura', `la sección ${n} está duplicada`);
    else sections.set(n, { n, title: m[2].trim(), body, order: k });
  });
  let lastOrder = -1;
  for (const t of template.sections) {
    const s = sections.get(t.n);
    if (!s) {
      error('estructura', `falta la sección "## ${t.n}. ${t.title}" (todas son obligatorias; si no aplica, "No aplica" y por qué)`);
      continue;
    }
    if (s.title !== t.title) error(`§${t.n}`, `se titula "${s.title}"; la plantilla dice "${t.title}"`);
    if (s.order < lastOrder) error(`§${t.n}`, 'está fuera del orden de la plantilla');
    lastOrder = Math.max(lastOrder, s.order);
    const body = s.body.replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!body) error(`§${t.n}`, 'está vacía; si no aplica, escribe "No aplica" y por qué');
    else if (/^no aplica\.?$/i.test(body)) error(`§${t.n}`, '"No aplica" sin explicar por qué');
  }
  for (const n of sections.keys()) {
    if (!template.sections.some((t) => t.n === n)) warn('estructura', `la sección ${n} no existe en la plantilla`);
  }

  // Cabecera.
  const firstH2 = headings.length ? headings[0].line : lines.length;
  const header = new Map();
  for (const line of masked.slice(h1Index + 1, firstH2)) {
    const cells = tableCells(line);
    if (cells && cells.length === 2 && !isSeparatorRow(cells) && cells[0] !== 'Campo') header.set(cells[0], cells[1]);
  }
  for (const { field, value } of template.header) {
    if (!header.has(field)) error('cabecera', `falta el campo "${field}"`);
    else if (!header.get(field)) error('cabecera', `el campo "${field}" está vacío`);
    else if (header.get(field) === value && value !== '—') error('cabecera', `"${field}" conserva el texto de la plantilla`);
  }
  const state = header.get('Estado');
  const approvedIdx = template.states.indexOf('Aprobada');
  const obsoleteIdx = template.states.indexOf('Obsoleta');
  const approvedLike = approvedIdx === -1 ? [] : template.states.slice(approvedIdx, obsoleteIdx === -1 ? undefined : obsoleteIdx);
  const draftLike = approvedIdx === -1 ? [] : template.states.slice(0, approvedIdx);
  if (state && !template.states.includes(state)) {
    error('cabecera', `estado "${state}" no válido; usa uno de: ${template.states.join(', ')} (sdd-process §6)`);
  }
  const approvalField = template.header.find((h) => /^aprobada/i.test(h.field))?.field;
  const approval = approvalField ? (header.get(approvalField) || '').trim() : '';
  const approvalUnset = !approval || /^[—–-]+$/.test(approval);
  if (approvedLike.includes(state) && approvalUnset) error('cabecera', `estado ${state} sin "${approvalField}": solo el líder aprueba y debe constar`);
  if (draftLike.includes(state) && !approvalUnset) warn('cabecera', `"${approvalField}" relleno en estado ${state}; solo se rellena al aprobar`);

  // Texto de la plantilla sin reemplazar.
  for (const p of template.placeholders) {
    if (spec.includes(p)) error('plantilla', `queda el marcador ${p}`);
  }
  if (/\bENG-[a-z]{3}\b/.test(spec)) error('plantilla', 'quedan identificadores de tarea de ejemplo (ENG-xxx)');
  const specLines = new Set(lines.map((l) => l.trim()));
  for (const g of template.guidance) {
    if (specLines.has(g)) error('plantilla', `queda texto guía de la plantilla: "${g.slice(0, 70)}${g.length > 70 ? '…' : ''}"`);
  }

  // Requisitos funcionales.
  const rfIds = [];
  const rfSection = N.rf && sections.get(N.rf);
  if (rfSection) {
    const start = headings.find((h) => h.text.startsWith(`${N.rf}.`)).line + 1;
    const bodyMasked = masked.slice(start, start + rfSection.body.split('\n').length);
    // Un RF se define en su propia línea, fuera de viñetas: "**RF-n …**", "1. **RF-n …**" o "### RF-n …".
    // Una viñeta que menciona otro RF ("- RF-2 …") no abre un bloque nuevo.
    const rfStart = /^ {0,3}(?:\d+\.\s+)?(?:(?:\*\*|__)RF-(\d+)\b|#{2,6}\s+(?:\*\*|__)?RF-(\d+)\b)/;
    let current = null;
    const blocks = [];
    for (const l of bodyMasked) {
      const m = l.match(rfStart);
      if (m) {
        current = { n: Number(m[1] || m[2]), text: l };
        blocks.push(current);
      } else if (current) current.text += `\n${l}`;
    }
    if (blocks.length === 0) error(`§${N.rf}`, 'no hay requisitos RF-n (cada uno en su línea: "**RF-n — Título.**" o "### RF-n — Título")');
    const seen = new Set();
    for (const b of blocks) {
      if (seen.has(b.n)) error(`§${N.rf}`, `RF-${b.n} está duplicado`);
      seen.add(b.n);
      rfIds.push(b.n);
      const missing = ['Dado', 'Cuando', 'Entonces'].filter((w) => !new RegExp(`(\\*\\*|__)${w}\\1`).test(b.text));
      if (missing.length) {
        const unbolded = missing.some((w) => new RegExp(`\\b${w}\\b`).test(b.text));
        error(`§${N.rf}`, `RF-${b.n} no tiene criterio completo: falta ${missing.map((w) => `**${w}**`).join(', ')}${unbolded ? ' (las palabras clave van en negrita, como en la plantilla)' : ''}`);
      }
      const vague = b.text.match(VAGUE_RESULT);
      if (vague) warn(`§${N.rf}`, `RF-${b.n}: "${vague[0]}" no es un resultado observable (código HTTP y code, estado persistido, texto visible)`);
    }
    const max = Math.max(0, ...seen);
    const gaps = [];
    for (let n = 1; n <= max; n++) if (!seen.has(n)) gaps.push(`RF-${n}`);
    if (gaps.length) warn(`§${N.rf}`, `numeración con saltos: faltan ${gaps.join(', ')}`);
  }

  // Cada RF con al menos una prueba, citado por su número (un rango "RF-1 a RF-25" no prueba los intermedios).
  const testsSection = N.tests && sections.get(N.tests);
  if (testsSection && rfIds.length) {
    const cited = new Set([...testsSection.body.matchAll(/\bRF-(\d+)\b/g)].map((m) => Number(m[1])));
    const untested = [...new Set(rfIds)].filter((n) => !cited.has(n));
    if (untested.length) error(`§${N.tests}`, `sin prueba asociada: ${untested.map((n) => `RF-${n}`).join(', ')} (cita cada RF por su número; los rangos no cuentan)`);
  }

  // Pendientes de CONTEXT §15: los asignados a esta spec bloquean su aprobación; los demás que mencione
  // deben figurar en preguntas abiertas como dependencia no bloqueante.
  if (baseId) {
    const assigned = [...pendings].filter(([, specs]) => specs.includes(specId) || specs.includes(baseId)).map(([p]) => p);
    const questions = (N.questions && sections.get(N.questions)?.body) || '';
    const questionLines = questions.split('\n');
    for (const p of assigned) {
      const withP = questionLines.filter((l) => new RegExp(`\\b${p}\\b`).test(l));
      if (withP.length === 0) {
        const msg = `CONTEXT §15 asigna ${p} a ${baseId}; debe figurar en preguntas abiertas con su propuesta marcada Propuesto`;
        isSplit ? warn(`§${N.questions}`, `${msg} (si corresponde a esta parte de la spec)`) : error(`§${N.questions}`, msg);
      } else if (!withP.some((l) => /\bpropuesto\b/i.test(l))) {
        error(`§${N.questions}`, `${p} figura en preguntas abiertas, pero su propuesta no está marcada Propuesto en la misma línea`);
      }
      if (approvedLike.includes(state)) error('cabecera', `estado ${state} con ${p} todavía abierto en CONTEXT §15`);
    }
    const mentioned = new Set();
    for (const s of sections.values()) {
      if (s.n === N.questions) continue;
      for (const m of s.body.matchAll(/\bP-\d+\b/g)) mentioned.add(m[0]);
    }
    for (const p of mentioned) {
      if (!pendings.has(p) || assigned.includes(p) || new RegExp(`\\b${p}\\b`).test(questions)) continue;
      const owner = pendings.get(p).join(', ') || 'una compuerta posterior';
      warn(`§${N.questions}`, `la spec menciona ${p} (lo cierra ${owner}) pero no lo lista en preguntas abiertas como dependencia no bloqueante`);
    }
  }

  // Tareas de la cabecera frente al taskboard.
  if (taskboard && header.has('Tareas')) {
    const listed = expandIds(header.get('Tareas'), 'ENG', 3, taskboard.ids);
    for (const id of listed) if (!taskboard.ids.has(id)) warn('cabecera', `${id} no existe en el taskboard`);
    const expected = specId ? taskboard.bySpec.get(specId) : null;
    if (expected) {
      const missing = expected.filter((id) => !listed.has(id));
      if (missing.length) warn('cabecera', `el taskboard asigna a ${specId} tareas que no están en "Tareas": ${missing.join(', ')}`);
    } else if (isSplit && taskboard.bySpec.has(baseId)) {
      warn('cabecera', `el taskboard aún asigna las tareas a ${baseId}; al dividir la spec, actualiza su columna Spec a ${specId} donde corresponda`);
    }
  }

  // Registro de cambios con al menos una fila.
  const changelog = N.changelog && sections.get(N.changelog);
  if (changelog) {
    const rows = changelog.body.split('\n').map(tableCells).filter(Boolean);
    const dataRows = rows.filter((c, i) => i > 0 && !isSeparatorRow(c));
    if (dataRows.length === 0) error(`§${N.changelog}`, 'el registro de cambios no tiene ninguna fila');
  }

  // Señales de alarma fuera de las secciones de exclusiones.
  const exempt = new Set([N.scope, N.outOfScope, N.questions, N.changelog]);
  for (const s of sections.values()) {
    if (exempt.has(s.n)) continue;
    for (const [re, reason, source] of RED_FLAGS) {
      const hits = s.body.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`));
      if (hits) warn(`§${s.n}`, `"${hits[0]}" (${hits.length}×): ${reason} (${source}); verifica que no lo introduce`);
    }
  }

  // Tamaño (sin contar la sintaxis de tablas ni otros signos sueltos).
  const words = spec.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const minutes = Math.round(words / READING_WORDS_PER_MINUTE);
  if (minutes > MAX_READING_MINUTES) {
    warn('tamaño', `${words} palabras (~${minutes} min de lectura); por encima de ${MAX_READING_MINUTES} min, dividir con sufijo (sdd-process §3 y §4)`);
  }

  // Índice de specs: el README.md de la misma carpeta que la spec.
  const readmePath = join(dirname(specPath), 'README.md');
  if (!existsSync(readmePath)) warn('índice', 'falta el README.md (índice) en la carpeta de la spec (tarea SPEC-00)');
  else if (specId && !readText(readmePath).includes(specId)) warn('índice', `el README.md de la carpeta no lista ${specId}`);

  // Informe.
  console.log(`check-spec — ${relative(process.cwd(), specPath) || file}`);
  console.log(`Plantilla: planning/sdd-process.md §5 (${template.sections.length} secciones) · Pendientes: CONTEXT §15 · Estado: ${state || '—'}`);
  for (const e of errors) console.log(`ERROR  ${e}`);
  for (const w of warnings) console.log(`AVISO  ${w}`);
  console.log(`Resultado: ${errors.length} error(es), ${warnings.length} aviso(s).${errors.length ? '' : ' Estructura válida; falta la validación semántica (references/validacion.md).'}`);
  process.exit(errors.length ? 1 : 0);
}

main();
