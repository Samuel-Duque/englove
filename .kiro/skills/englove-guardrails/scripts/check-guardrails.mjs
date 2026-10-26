#!/usr/bin/env node
// Verificación automática de las reglas invariantes de Englove (skill englove-guardrails).
//
// Uso (desde la raíz del repositorio):
//   node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs                 cambios sin confirmar frente a HEAD (+ archivos nuevos)
//   node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs --base main     cambios desde el merge-base con main (incluye lo no confirmado)
//   node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs --all           todo el repositorio
//   node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs apps/api        archivos o carpetas concretos (completos)
//   Opciones: --json, --root RUTA, --self-check, --help
//
// No duplica la planeación: lee en cada ejecución la matriz de tablas de tenant de
// planning/architecture-overview.md §6.2, las tablas de detalle de .agents/CONTEXT.md §7.2 y
// el registro de decisiones de CONTEXT §14. El catálogo explicado vive en references/reglas.md.
// En modo diff, las reglas de línea solo miran las líneas añadidas; las de archivo, el archivo completo.
// Sale con 0 sin errores, 1 con errores y 2 si no puede leer sus insumos.
// Supresión: comentario "guardrails-ignore G-XNN: motivo" en la misma línea o en la anterior.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Lo último que este script conoce de la planeación. Si CONTEXT avanza, el script avisa.
const KNOWN_MAX_DECISION = 111;
const KNOWN_OUT_OF_SCOPE_ROWS = 9; // filas de la tabla de CONTEXT §2.4
const MAX_FILE_BYTES = 1024 * 1024;

const RULES = {
  'G-A01': { title: 'Sin Supabase', source: 'decisión 82; CONTEXT §6 y §16' },
  'G-A02': { title: 'Autorización en NestJS, no en RLS', source: 'decisión 82; architecture §4.3' },
  'G-A03': { title: 'Doble cadena de conexión de Prisma', source: 'decisión 82; architecture §11.2 y §11.4' },
  'G-A04': { title: 'Nunca prisma db push fuera de local', source: 'CONTEXT §6; architecture §11.2; SPEC-01 RF-17' },
  'G-A05': { title: 'organization_id directo en tablas de tenant', source: 'decisión 89; architecture §6.2' },
  'G-A06': { title: 'Consultas de tenant filtradas por organization_id', source: 'CONTEXT §16; architecture §4.3' },
  'G-A07': { title: 'SQL crudo seguro y con tenant', source: 'architecture §4.3 y §8.3' },
  'G-A08': { title: 'onDelete explícito en toda relación', source: 'decisiones 80 y 92; architecture §6.2' },
  'G-A09': { title: 'Modelo de datos vigente, sin campos retirados', source: 'decisiones 22, 25, 35, 72, 77 y 79; architecture §6.3–§6.4' },
  'G-A10': { title: 'Attempt.score numeric(2,1) con CHECK', source: 'decisiones 24 y 72; architecture §4.4' },
  'G-A11': { title: 'Prevención de IDOR y acceso a datos de tenant', source: 'decisiones 82 y 89; architecture §4.3 y §8.1' },
  'G-B01': { title: 'Sin Vercel, Cloudflare Pages ni OpenNext', source: 'decisiones 82, 85 y 87; architecture §11.3' },
  'G-B02': { title: 'proxy.ts, nunca middleware.ts ni Edge', source: 'decisiones 81 y 88; architecture §3.8' },
  'G-B03': { title: 'proxy.ts solo redirige', source: 'decisiones 58 y 81; architecture §8.2' },
  'G-B04': { title: 'Caché explícita y nunca autenticada', source: 'decisiones 81 y 88; architecture §3.8' },
  'G-B05': { title: 'Arrastre con @atlaskit/pragmatic-drag-and-drop', source: 'decisión 81; architecture §3.8' },
  'G-B06': { title: 'Worker de Cloudflare bien configurado', source: 'decisión 85; architecture §3.8 y §11.3' },
  'G-B07': { title: 'Imagen de la API con ffmpeg/ffprobe', source: 'decisión 64; architecture §3.5 y §11.3' },
  'G-B08': { title: 'Una sola instancia de la API', source: 'decisión 64; architecture §11.3 y §11.4' },
  'G-B09': { title: 'Cola de transcodificación serial', source: 'decisiones 64 y 84; architecture §3.5 y §4.5' },
  'G-B10': { title: 'Archivos en R2 privado con URL prefirmada', source: 'decisión 55; CONTEXT §16; architecture §11.3' },
  'G-B11': { title: 'Cookies, tokens y CORS', source: 'decisión 58; CONTEXT §10; architecture §8.2' },
  'G-B12': { title: 'Entornos y planes coherentes', source: 'decisiones 82 y 86; architecture §11.1' },
  'G-B13': { title: 'Ejecución segura de ffmpeg y validación R2', source: 'decisiones 55, 64 y 84; architecture §3.5 y §7.6' },
  'G-C01': { title: 'Identificadores en inglés', source: 'decisión 20; CONTEXT §16' },
  'G-C02': { title: 'Nota calculada en el servidor', source: 'decisiones 24 y 72; architecture §4.4' },
  'G-C03': { title: 'Timestamps del servidor y whitelist', source: 'decisión 37; architecture §4.4 y §5.2' },
  'G-C04': { title: 'answer_key fuera de las respuestas al alumno', source: 'decisión 75; architecture §5.3' },
  'G-C05': { title: 'Entidades y funciones eliminadas', source: 'decisiones 11, 34–36 y 41; CONTEXT §16' },
  'G-C06': { title: 'Fuera de alcance del piloto', source: 'CONTEXT §2.4 y §9' },
  'G-C07': { title: 'Rutas bajo /api/v1; /health y /docs en la raíz', source: 'decisión 83; architecture §13' },
  'G-C08': { title: 'Zona horaria America/Bogota', source: 'decisión 67; architecture §4.5' },
  'G-C09': { title: 'Tareas periódicas con ScheduledJobRun', source: 'decisiones 64 y 76; architecture §4.5' },
  'G-C10': { title: 'Sin datos personales en logs ni errores', source: 'CONTEXT §9; architecture §4.6 y §8.5' },
  'G-C11': { title: 'Secretos solo en variables de entorno', source: 'CONTEXT §10; architecture §8.1' },
  'G-C12': { title: 'Tipado estricto y validación en dos niveles', source: 'decisión 20; architecture §4.2; SPEC-01 RF-1 y RF-13' },
  'G-C13': { title: 'Higiene en dispositivos compartidos y enlaces seguros', source: 'decisiones 20 y 51; architecture §8.5 y §10.1' },
};

// ---------------------------------------------------------------- utilidades

function fatal(msg) {
  console.error(`check-guardrails: ${msg}`);
  process.exit(2);
}

const toPosix = (p) => p.split(sep).join('/');
const readText = (p) => readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

function parseArgs(argv) {
  const opts = { base: null, all: false, json: false, root: null, selfCheck: false, paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      console.log(
        'Uso: node check-guardrails.mjs [--base REF | --all | RUTAS...] [--json] [--root RUTA] [--self-check]\n' +
          'Sin argumentos revisa los cambios sin confirmar frente a HEAD y los archivos nuevos.',
      );
      process.exit(0);
    } else if (a === '--base') opts.base = argv[++i] ?? fatal('--base necesita una referencia (rama, commit o tag)');
    else if (a === '--all') opts.all = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--root') opts.root = argv[++i] ?? fatal('--root necesita una ruta');
    else if (a === '--self-check') opts.selfCheck = true;
    else if (a.startsWith('--')) fatal(`opción desconocida: ${a}`);
    else opts.paths.push(a);
  }
  if ([opts.base !== null, opts.all, opts.paths.length > 0].filter(Boolean).length > 1) {
    fatal('usa solo uno de: --base, --all o rutas');
  }
  return opts;
}

function findRoot(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.agents', 'CONTEXT.md')) && existsSync(join(dir, 'planning', 'architecture-overview.md'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

function isGitRepo(root) {
  try {
    return git(root, ['rev-parse', '--is-inside-work-tree']).trim() === 'true';
  } catch {
    return false;
  }
}

// Texto de una sección "## N." hasta la siguiente "## " fuera de bloques ```.
function sliceH2(md, number) {
  const lines = md.split('\n');
  let inFence = false;
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) inFence = !inFence;
    if (inFence) continue;
    if (start === -1 && new RegExp(`^## ${number}\\.\\s`).test(lines[i])) start = i;
    else if (start !== -1 && /^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return start === -1 ? null : lines.slice(start + 1, end).join('\n');
}

function sliceH3(md, prefix) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`### ${prefix}`));
  if (start === -1) return null;
  let end = lines.findIndex((l, i) => i > start && /^#{2,3} /.test(l));
  if (end === -1) end = lines.length;
  return lines.slice(start + 1, end).join('\n');
}

// ---------------------------------------------------------------- planeación viva

function loadPlanning(root) {
  const context = readText(join(root, '.agents', 'CONTEXT.md'));
  const arch = readText(join(root, 'planning', 'architecture-overview.md'));
  const notes = [];

  // Matriz de tenant (architecture §6.2) + tablas de detalle (CONTEXT §7.2).
  let tenantModels = null;
  const sec62 = sliceH3(arch, '6.2');
  const matrixLine = sec62?.split('\n').find((l) => /matriz de tablas de tenant/i.test(l));
  if (matrixLine) {
    const head = matrixLine.split(/\bllevan\b/)[0];
    tenantModels = new Set([...head.matchAll(/`([A-Z]\w+)`/g)].map((m) => m[1]));
    if (/tablas de detalle/i.test(head)) {
      const sec72 = sliceH3(context, '7.2') ?? '';
      for (const m of sec72.matchAll(/`([A-Z]\w*Detail)`/g)) tenantModels.add(m[1]);
    }
    if (tenantModels.size < 10) {
      notes.push(`La matriz de tenant de architecture §6.2 solo dio ${tenantModels.size} modelos; G-A05 puede estar incompleta.`);
    }
  } else {
    notes.push('No se encontró la matriz de tablas de tenant en architecture §6.2; G-A05 no se verifica.');
  }

  // Decisiones de CONTEXT §14.
  const decisions = new Map();
  const sec14 = sliceH2(context, 14) ?? '';
  for (const line of sec14.split('\n')) {
    const m = line.match(/^\|\s*(\d+)\s*\|/);
    if (!m) continue;
    const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim());
    decisions.set(Number(m[1]), cells[cells.length - 1] ?? '');
  }
  const maxDecision = decisions.size ? Math.max(...decisions.keys()) : 0;
  if (maxDecision > KNOWN_MAX_DECISION) {
    notes.push(
      `CONTEXT §14 tiene decisiones posteriores a la ${KNOWN_MAX_DECISION} (hasta la ${maxDecision}). ` +
        'Revisa si cambian alguna regla de references/reglas.md y actualiza KNOWN_MAX_DECISION.',
    );
  }

  // Filas de la tabla de fuera de alcance (CONTEXT §2.4).
  const sec24 = sliceH3(context, '2.4') ?? '';
  const outRows = sec24.split('\n').filter((l) => /^\|/.test(l.trim()) && !/^\|\s*:?-+/.test(l.trim())).length - 1;
  if (outRows !== KNOWN_OUT_OF_SCOPE_ROWS) {
    notes.push(`CONTEXT §2.4 tiene ${outRows} elementos (el script conoce ${KNOWN_OUT_OF_SCOPE_ROWS}). Revisa G-C06.`);
  }

  return { tenantModels, decisions, maxDecision, notes };
}

// ---------------------------------------------------------------- alcance

const EXCLUDED_DIRS = /(^|\/)(node_modules|\.git|\.agents|\.claude|\.kiro|planning|specs|dist|build|out|coverage|\.next|\.turbo|\.wrangler|\.vinext|[\w.-]+-workspace)(\/|$)/;
const LOCKFILES = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|skills-lock\.json)$/;
const SCANNABLE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|json|jsonc|prisma|sql|ya?ml|toml|sh|ps1|html|md|mdx)$|(^|\/)(Dockerfile[^/]*|\.env[^/]*)$/;

const inScope = (p) => !EXCLUDED_DIRS.test(p) && !LOCKFILES.test(p) && SCANNABLE.test(p);

function walk(root, dir, out) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = toPosix(relative(root, abs));
    if (EXCLUDED_DIRS.test(rel + '/')) continue;
    const st = statSync(abs);
    if (st.isDirectory()) walk(root, abs, out);
    else out.push(rel);
  }
  return out;
}

function listRepoFiles(root, useGit, pathspecs = []) {
  if (useGit) {
    const outp = git(root, ['ls-files', '-co', '--exclude-standard', '--', ...pathspecs]);
    return outp.split('\n').filter(Boolean);
  }
  if (!pathspecs.length) return walk(root, root, []);
  const out = [];
  for (const p of pathspecs) {
    const abs = resolve(root, p);
    if (!existsSync(abs)) fatal(`no existe la ruta: ${p}`);
    if (statSync(abs).isDirectory()) walk(root, abs, out);
    else out.push(toPosix(relative(root, abs)));
  }
  return out;
}

function parseDiff(text) {
  const added = new Map();
  let current = null;
  let line = 0;
  for (const raw of text.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const p = raw.slice(4).trim();
      current = p === '/dev/null' ? null : p.replace(/^b\//, '');
      if (current && !added.has(current)) added.set(current, new Set());
    } else if (raw.startsWith('@@')) {
      const m = raw.match(/\+(\d+)(?:,(\d+))?/);
      line = m ? Number(m[1]) : 0;
    } else if (current && raw.startsWith('+')) {
      added.get(current).add(line++);
    } else if (current && raw.startsWith(' ')) {
      line++;
    }
  }
  return added;
}

function resolveScope(root, opts) {
  const useGit = isGitRepo(root);
  if (opts.all || opts.paths.length) {
    const files = listRepoFiles(root, useGit, opts.paths).filter(inScope);
    const label = opts.all ? 'todo el repositorio' : `rutas: ${opts.paths.join(', ')}`;
    return { label, files: files.map((path) => ({ path, added: null })) };
  }
  if (!useGit) fatal('el modo diff necesita un repositorio git; usa --all o rutas concretas');
  let baseRef = 'HEAD';
  let label = 'cambios sin confirmar frente a HEAD';
  if (opts.base) {
    try {
      baseRef = git(root, ['merge-base', opts.base, 'HEAD']).trim();
    } catch {
      fatal(`no se pudo resolver el merge-base con "${opts.base}"`);
    }
    label = `cambios desde ${opts.base} (merge-base ${baseRef.slice(0, 7)}), incluidos los no confirmados`;
  } else {
    try {
      git(root, ['rev-parse', '--verify', 'HEAD']);
    } catch {
      return { label: 'repositorio sin commits: todos los archivos', files: listRepoFiles(root, true).filter(inScope).map((path) => ({ path, added: null })) };
    }
  }
  const diff = git(root, ['diff', '--unified=0', '--no-color', '--no-ext-diff', '--diff-filter=ACMR', baseRef]);
  const added = parseDiff(diff);
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  const files = [];
  for (const [path, lines] of added) if (inScope(path) && lines.size) files.push({ path, added: lines });
  for (const path of untracked) if (inScope(path) && !added.has(path)) files.push({ path, added: null });
  return { label, files };
}

// ---------------------------------------------------------------- predicados de ruta

const ext = (p) => (p.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
const isCode = (p) => /^(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(ext(p));
const isDoc = (p) => /^(md|mdx)$/.test(ext(p));
const isTest = (p) => /(\.(spec|test|e2e-spec)\.[cm]?[jt]sx?$)|(^|\/)(test|tests|e2e|__tests__|fixtures?)\//.test(p);
const isApi = (p) => p.startsWith('apps/api/');
const isApiSrc = (p) => p.startsWith('apps/api/src/') && isCode(p);
const isWeb = (p) => p.startsWith('apps/web/');
const isPrisma = (p) => ext(p) === 'prisma';
const isDto = (p) => /\.dto\.[cm]?ts$/.test(p);
const isSharedApi = (p) => /^packages\/shared\/src\/api\//.test(p) && isCode(p);
const isSharedActivity = (p) => /^packages\/shared\/src\/activities\//.test(p) && isCode(p);
const isSharedSrc = (p) => p.startsWith('packages/shared/src/') && isCode(p);
const isSeed = (p) => /(^|\/)seeds?(\/|[-.])|seed[-.]/i.test(p);
const isMigrationSql = (p) => /(^|\/)migrations\/.+\.sql$/.test(p);
const isExecutable = (p) =>
  basename(p) === 'package.json' || /^(ya?ml|sh|ps1|toml)$/.test(ext(p)) || /(^|\/)Dockerfile[^/]*$/.test(p) || isCode(p);
const any = () => true;
const notDoc = (p) => !isDoc(p);

// ---------------------------------------------------------------- reglas de línea
// { id, sev, re, msg, files?, skip?(line, ctx), when?(ctx) -> boolean, docSev? }
// "when" recibe { lines, i, path, text } y devuelve true si hay incumplimiento.

const windowHas = (lines, i, re, n = 12) => lines.slice(i, i + n + 1).some((l) => re.test(l));

const TIMESTAMP_FIELD = /\b(started_?at|finished_?at|graded_?at|occurred_?at|joined_?at|left_?at|created_?at|updated_?at|deleted_?at|awarded_?at|rotated_?at|revoked_?at|used_?at|terms_?accepted_?at)\s*[?!]?\s*:/i;

const LINE_RULES = [
  // A. Motor SQL y persistencia
  { id: 'G-A01', sev: 'ERROR', docSev: 'AVISO', files: any, re: /@supabase\/|supabase\.(co|com)\b|\bSUPABASE_[A-Z_]+|supabase\/config\.toml/i, msg: 'referencia a Supabase; el motor SQL es Neon y los archivos van a R2' },
  { id: 'G-A02', sev: 'ERROR', files: notDoc, re: /ENABLE\s+ROW\s+LEVEL\s+SECURITY|CREATE\s+POLICY|\bauth\.uid\(\)|current_setting\(\s*'request\.jwt/i, msg: 'RLS o políticas de Postgres como autorización; la autorización es de NestJS (guards + TenantContext)' },
  { id: 'G-A03', sev: 'ERROR', files: (p) => (isApiSrc(p) || isWeb(p)) && !isTest(p), re: /MIGRATION_DATABASE_URL/, msg: 'MIGRATION_DATABASE_URL en código de runtime; solo la usa prisma migrate deploy en CI (el runtime usa DATABASE_URL por el pooler)' },
  { id: 'G-A04', sev: 'ERROR', files: (p) => isExecutable(p) && !isDoc(p), re: /\bdb\s+push\b/, msg: 'prisma db push en un archivo ejecutable versionado; fuera de local se usa siempre prisma migrate deploy' },
  {
    id: 'G-A06', sev: 'AVISO', files: (p) => isApiSrc(p) && !isTest(p) && !isSeed(p),
    re: /\b(?:this\.)?(?:prisma|tx|db|client|trx)\.(\w+)\.(findMany|findFirst|findFirstOrThrow|updateMany|deleteMany|count|aggregate|groupBy)\(/,
    skip: (line) => /\.(organization|user)\.\w+\(/.test(line),
    when: ({ lines, i }) => !windowHas(lines, i, /organization_?id|organizationId|\borgId\b|tenant/i, 12),
    msg: 'consulta de tenant sin filtro explícito por organization_id cerca (doble filtro: extensión de Prisma + servicio)',
  },
  { id: 'G-A07', sev: 'ERROR', files: (p) => isCode(p), re: /\$(queryRawUnsafe|executeRawUnsafe)\b/, msg: 'SQL crudo sin parametrizar; usa $queryRaw con plantilla' },
  {
    id: 'G-A07', sev: 'AVISO', files: (p) => isApiSrc(p) && !isTest(p) && !isSeed(p), re: /\$(queryRaw|executeRaw)\s*[`(]/,
    when: ({ lines, i }) => !windowHas(lines, i, /organization_?id|organizationId/i, 10),
    msg: 'SQL crudo sin organization_id visible; toda consulta de tenant filtra por organización',
  },
  {
    id: 'G-A11', sev: 'AVISO', files: (p) => isApiSrc(p) && !isTest(p) && !isSeed(p),
    re: /\b(?:this\.)?(?:prisma|tx|db|client|trx)\.(\w+)\.findUnique\(/,
    skip: (line) => /\.(organization|user)\.findUnique\(/.test(line),
    msg: 'findUnique sobre entidad de tenant; para prevenir IDOR usa findFirst con filtro de organization_id o clave compuesta con organization_id',
  },
  {
    id: 'G-A08', sev: 'ERROR', files: isPrisma, re: /@relation\([^)]*fields\s*:/,
    when: ({ lines, i }) => !/onDelete\s*:/.test(lines[i]),
    msg: 'relación sin onDelete explícito; usa el valor de la tabla de architecture §6.2',
  },
  { id: 'G-A09', sev: 'ERROR', files: notDoc, re: /\bmax_?attempts\b|\bmaxAttempts\b/i, msg: 'max_attempts no existe: un intento por asignación + habilitación de la profesora (decisiones 25 y 74)' },
  { id: 'G-A09', sev: 'ERROR', files: notDoc, re: /must_?change_?password|mustChangePassword/i, msg: 'no hay contraseñas temporales ni must_change_password (decisión 35)' },
  { id: 'G-A09', sev: 'ERROR', files: notDoc, re: /classroom_?code|classroomCode/i, msg: 'el acceso por código de aula fue descartado (decisión 22)' },
  { id: 'G-A09', sev: 'ERROR', files: notDoc, re: /\bRegistrationSource\b/, msg: 'RegistrationSource fue eliminado: el auto-registro es la única vía de alta (decisión 34)' },

  // B. Despliegue y hosting
  { id: 'G-B01', sev: 'ERROR', docSev: 'AVISO', files: any, re: /vercel\.json|@vercel\/|\bVERCEL_[A-Z_]+|\bvercel\s+(deploy|build|--prod)|wrangler\s+pages|pages_build_output_dir|@cloudflare\/next-on-pages|@opennextjs\/cloudflare/i, msg: 'Vercel, Cloudflare Pages u OpenNext; la web se despliega solo como Worker con vinext y Wrangler' },
  { id: 'G-B02', sev: 'ERROR', files: (p) => isCode(p), re: /export\s+const\s+runtime\s*=\s*['"]edge['"]|runtime\s*:\s*['"]edge['"]/, msg: 'runtime Edge; Next.js 16 en Englove usa runtime Node.js (proxy.ts no admite Edge)' },
  { id: 'G-B04', sev: 'AVISO', files: (p) => isWeb(p) && isCode(p), re: /\bunstable_cache\b|export\s+const\s+revalidate\s*=|['"]force-static['"]/, msg: 'caché implícita o heredada; el modelo es explícito con "use cache" y cacheComponents: true' },
  { id: 'G-B05', sev: 'ERROR', files: notDoc, re: /@dnd-kit\/|['"]react-dnd['"]|react-beautiful-dnd|@hello-pangea\/dnd/, msg: 'librería de arrastre no decidida; se usa @atlaskit/pragmatic-drag-and-drop' },
  { id: 'G-B08', sev: 'AVISO', files: notDoc, re: /['"](ioredis|redis|bullmq|bull|@nestjs\/bull|@nestjs\/bullmq|@nest-lab\/throttler-storage-redis|cache-manager-redis-store)['"]|ThrottlerStorageRedisService/, msg: 'almacén compartido de cola o rate limiting; con una sola instancia no hace falta y externalizarlo exige decisión nueva (decisión 64)' },
  { id: 'G-B08', sev: 'AVISO', files: (p) => isApiSrc(p) && !isTest(p), re: /\bsetInterval\(/, msg: 'temporizador de proceso en la API; las tareas periódicas van con @nestjs/schedule y ScheduledJobRun' },
  {
    id: 'G-B09', sev: 'AVISO', files: (p) => isApiSrc(p) && !isTest(p), re: /concurrency\s*[:=]\s*([2-9]|\d{2,})|Promise\.all\(/,
    when: ({ text }) => /ffmpeg|transcod/i.test(text),
    msg: 'posible transcodificación en paralelo; la cola es serial (una conversión a la vez en 512 MB)',
  },
  { id: 'G-B10', sev: 'ERROR', files: (p) => isApi(p) && notDoc(p), re: /\bFiles?Interceptor\b|@UploadedFiles?\(|['"]multer['"]|['"]busboy['"]|['"]@fastify\/multipart['"]/, msg: 'subida de archivos a través de la API; los audios suben directo a R2 con URL prefirmada' },
  { id: 'G-B10', sev: 'ERROR', files: notDoc, re: /['"]public-read(-write)?['"]/, msg: 'objeto público en el bucket; R2 es privado y se accede con URLs firmadas de corta duración' },
  { id: 'G-B10', sev: 'AVISO', files: notDoc, re: /@google-cloud\/storage|firebase\/storage|['"]aws-sdk['"]/, msg: 'SDK de almacenamiento no decidido; R2 se usa con @aws-sdk/client-s3' },
  {
    id: 'G-B11', sev: 'ERROR', files: (p) => isApiSrc(p) && !isTest(p), re: /\.(cookie|setCookie)\(\s*[^)]/,
    skip: (line) => /clearCookie/.test(line),
    when: ({ lines, i }) => !windowHas(lines, i, /httpOnly\s*:\s*true/, 10) && !windowHas(lines, i, /cookieOptions|COOKIE_OPTIONS|sessionCookie/i, 3),
    msg: 'cookie sin httpOnly: true visible; las cookies de sesión son HttpOnly, Secure, SameSite=Lax y con COOKIE_PREFIX',
  },
  { id: 'G-B11', sev: 'ERROR', files: (p) => isCode(p), re: /(localStorage|sessionStorage)\.setItem\(\s*[^,]*(token|jwt|session|auth|refresh)/i, msg: 'token en almacenamiento del navegador; los tokens viven solo en cookies httpOnly' },
  { id: 'G-B11', sev: 'ERROR', files: (p) => isApiSrc(p), re: /origin\s*:\s*(['"]\*['"]|true)\b|enableCors\(\s*\)/, msg: 'CORS abierto; allowlist explícita con credentials: true y validación de Origin' },
  { id: 'G-B11', sev: 'AVISO', files: (p) => isCode(p), re: /sameSite\s*:\s*['"]none['"]/i, msg: 'SameSite=None; la decisión es SameSite=Lax con Domain=.<dominio>' },
  {
    id: 'G-B13', sev: 'AVISO', files: (p) => isApiSrc(p) && !isTest(p),
    re: /\bexec\(\s*`[^`]*ffmpeg/,
    msg: 'ejecución de ffmpeg interpolando comandos en shell; usa array de argumentos con shell: false o fluent-ffmpeg',
  },

  // C. Negocio, integridad y seguridad
  { id: 'G-C01', sev: 'AVISO', files: (p) => isCode(p) || isPrisma(p), re: /\b(const|let|var|function|class|interface|type|enum|model)\s+[\w$]*[áéíóúñÁÉÍÓÚÑü]/, msg: 'identificador con tildes o ñ; los identificadores van en inglés' },
  { id: 'G-C02', sev: 'ERROR', files: (p) => (isDto(p) || isSharedApi(p)) && !/review/i.test(p), re: /^\s*(readonly\s+)?score\s*[?!]?\s*:/, msg: 'score en un contrato de entrada; la nota la calcula el servidor (solo la revisión manual de la profesora la recibe)' },
  { id: 'G-C02', sev: 'AVISO', files: isSharedActivity, re: /^\s*score\s*[?!]?\s*:/, msg: 'score en un esquema de actividad; si es una respuesta del alumno, el servidor no debe aceptarla' },
  {
    id: 'G-C02', sev: 'AVISO', files: (p) => isApiSrc(p) && !isTest(p), re: /\breviews?\.(create|update|upsert)\(/,
    when: ({ lines, i }) => windowHas(lines, i, /\bscore\s*:/, 10),
    msg: 'posible escritura de score en Review; la nota vive solo en Attempt.score (decisión 72)',
  },
  { id: 'G-C03', sev: 'ERROR', files: (p) => isDto(p) && !/response/i.test(p), re: new RegExp(`^\\s*(readonly\\s+)?${TIMESTAMP_FIELD.source}`, 'i'), msg: 'timestamp en un DTO de entrada; lo asigna el servidor (permitidos solo opens_at, due_at y retry_extend_until)' },
  { id: 'G-C03', sev: 'AVISO', files: isSharedApi, re: new RegExp(`^\\s*(readonly\\s+)?${TIMESTAMP_FIELD.source}`, 'i'), msg: 'timestamp en un tipo de API compartido; correcto en respuestas, prohibido en esquemas de entrada' },
  { id: 'G-C03', sev: 'AVISO', files: isSharedApi, re: /^\s*at\s*\??\s*:/, msg: 'campo "at" en un esquema de API; el "at" del contrato de actividad es interno del cliente' },
  {
    id: 'G-C03', sev: 'ERROR', files: (p) => isApiSrc(p), re: /new\s+ValidationPipe\(/,
    when: ({ lines, i }) => !windowHas(lines, i, /whitelist\s*:\s*true/, 8),
    msg: 'ValidationPipe sin whitelist: true; los campos no declarados (como timestamps del cliente) deben descartarse',
  },
  {
    id: 'G-C04', sev: 'AVISO', files: (p) => isCode(p) && !isTest(p) && !/scor|editor|game|seed/i.test(p), re: /\b(answer_key|answerKey)\s*:\s*true\b/,
    msg: 'selección explícita de answer_key fuera del scoring o del editor de la profesora',
  },
  { id: 'G-C05', sev: 'ERROR', files: notDoc, re: /\bGuardians?\b|\bguardians\b/, msg: 'Guardian no existe; el acudiente solo son los campos Student.guardian_name y guardian_contact (decisión 35)' },
  { id: 'G-C05', sev: 'ERROR', files: notDoc, re: /Consent(Record|Status|Method)\b/, msg: 'entidades de consentimiento eliminadas (decisión 36)' },
  { id: 'G-C05', sev: 'AVISO', files: notDoc, re: /\bconsent(imiento)?\b/i, msg: 'posible gestión de consentimiento legal de menores, fuera de la plataforma (CONTEXT §9, decisión 91)' },
  { id: 'G-C05', sev: 'ERROR', files: notDoc, re: /\b(mfa|totp|two[-_]?factor|2fa|otplib|speakeasy)\b/i, msg: 'autenticación multifactor fuera del piloto (el OTP de cambio de correo no es MFA)' },
  { id: 'G-C05', sev: 'ERROR', files: notDoc, re: /['"](stats|leaderboard)['"]/, when: ({ lines, i }) => /flag|FeatureFlag|\bkey\b/i.test(lines[i]), msg: 'flags stats o leaderboard eliminados; el panel estadístico se controla solo por RBAC (decisión 41)' },
  { id: 'G-C06', sev: 'ERROR', files: notDoc, re: /['"]socket\.io(-client)?['"]|@nestjs\/websockets|@nestjs\/platform-(socket\.io|ws)|@WebSocketGateway|\bnew\s+WebSocket\(|from\s+['"]ws['"]|^\s*"ws"\s*:|\bnew\s+EventSource\(|@Sse\(/, msg: 'tiempo real (WebSockets/SSE) fuera del piloto; polling cada 30 s' },
  { id: 'G-C06', sev: 'AVISO', files: (p) => isCode(p) && !isTest(p), re: /heartbeat|visibilitychange/i, msg: 'heartbeat o detección de inactividad fuera del piloto; solo inicio y fin de actividad (válido para pausar audio o animaciones)' },
  { id: 'G-C06', sev: 'ERROR', files: notDoc, re: /['"]phaser['"]|\bPhaser\./, msg: 'Phaser es Fase 2; microjuegos en React' },
  { id: 'G-C06', sev: 'ERROR', files: (p) => isCode(p) || ext(p) === 'html', re: /<iframe\b/i, msg: 'contenido embebido (iframe); Educaplay va como enlace externo en Contenido extra' },
  { id: 'G-C06', sev: 'ERROR', files: notDoc, re: /@capacitor\//, msg: 'Capacitor es Fase 2; el piloto es PWA' },
  { id: 'G-C06', sev: 'ERROR', files: notDoc, re: /['"](stripe|@stripe\/[\w-]+|wompi[\w-]*|epayco[\w-]*|mercadopago|@paypal\/[\w-]+)['"]|api\.stripe\.com|checkout\.wompi|epayco\.co/i, msg: 'pasarela de pagos fuera del piloto' },
  {
    id: 'G-C06',
    sev: 'ERROR',
    files: notDoc,
    skip: (line) => /(?:min|umbral|m[ií]nimo|duraci[oó]n)_?\s*plausible|minPlausible/i.test(line),
    re: /googletagmanager|google-analytics|\bgtag\(|@vercel\/analytics|mixpanel|@segment\/|hotjar|\bfbq\(|connect\.facebook\.net|posthog|plausible|@amplitude\//i,
    msg: 'analítica de terceros o píxeles; prohibidos en el portal del estudiante (CONTEXT §9)',
  },
  { id: 'G-C07', sev: 'AVISO', files: isApiSrc, re: /@Controller\(\s*['"]\/?api\//, msg: 'el controlador repite el prefijo; /api/v1 se fija con setGlobalPrefix' },
  {
    id: 'G-C08', sev: 'ERROR', files: (p) => isApiSrc(p), re: /@Cron\(/,
    when: ({ lines, i }) => !windowHas(lines, i, /timeZone\s*:\s*['"]America\/Bogota['"]/, 5),
    msg: "tarea programada sin timeZone: 'America/Bogota'",
  },
  { id: 'G-C08', sev: 'AVISO', files: (p) => isCode(p) && !isTest(p), re: /['"](America\/(?!Bogota['"])[A-Za-z_]+|Europe\/[A-Za-z_]+|Asia\/[A-Za-z_]+|US\/[A-Za-z_]+)['"]/, msg: 'zona horaria distinta de America/Bogota' },
  { id: 'G-C10', sev: 'AVISO', files: (p) => isCode(p) && !isTest(p), re: /\b(logger|log|console|Sentry)\.(log|info|debug|warn|error|trace|fatal|captureMessage)\(.*\b(email|password|token|body|answers|refresh_?token|otp)\b/i, msg: 'posible dato personal o secreto en un log; solo identificadores' },
  { id: 'G-C10', sev: 'AVISO', files: (p) => isApiSrc(p) && !isTest(p), re: /\bconsole\.(log|info|debug)\(/, msg: 'console.log en la API; usa el logger estructurado (nestjs-pino) sin datos personales' },
  { id: 'G-C10', sev: 'ERROR', files: (p) => isCode(p), re: /sendDefaultPii\s*:\s*true/, msg: 'Sentry con datos personales; sendDefaultPii: false' },
  { id: 'G-C10', sev: 'AVISO', files: (p) => /\.filter\.[cm]?ts$/.test(p), re: /\bstack\b\s*[:,}]/, skip: (line) => /logger|log\.|console/.test(line), msg: 'posible stack trace en la respuesta de error; el cliente solo recibe { statusCode, code, message }' },
  { id: 'G-C11', sev: 'ERROR', files: notDoc, re: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, msg: 'clave privada en el repositorio' },
  {
    id: 'G-C11', sev: 'ERROR', files: notDoc, re: /postgres(?:ql)?:\/\/[^\s:@'"/]+:([^\s@'"]+)@([^\s/'":]+)/,
    when: ({ lines, i }) => {
      const m = lines[i].match(/postgres(?:ql)?:\/\/[^\s:@'"/]+:([^\s@'"]+)@([^\s/'":]+)/);
      if (!m) return false;
      const [, pwd, host] = m;
      const placeholder = /^(\$\{|\$|<|\*+$|x+$|password$|pass$|changeme|secret$|postgres$|your)/i.test(pwd);
      const local = /^(localhost|127\.0\.0\.1|postgres|db|database|host\.docker\.internal)$/i.test(host);
      return !placeholder && !local;
    },
    msg: 'cadena de conexión con contraseña real; los secretos van en variables de entorno',
  },
  { id: 'G-C11', sev: 'ERROR', files: notDoc, re: /\bsk_live_[0-9a-zA-Z]{10,}|\bre_[A-Za-z0-9]{20,}\b|\bAKIA[0-9A-Z]{16}\b/, msg: 'clave con forma de secreto en el repositorio' },
  { id: 'G-C11', sev: 'ERROR', files: any, re: /\bNEXT_PUBLIC_[A-Z0-9_]*(SECRET|PRIVATE|PASSWORD|DATABASE|R2_SECRET)/, msg: 'variable secreta con prefijo NEXT_PUBLIC_ (iría al bundle web)' },
  {
    id: 'G-C12', sev: 'ERROR',
    files: (p) => (isApiSrc(p) || isWeb(p) || isSharedSrc(p)) && !isTest(p) && !isMigrationSql(p),
    re: /\b(?:as\s+any\b|:\s*any\b|@ts-ignore|@ts-nocheck)/,
    msg: 'uso de any, @ts-ignore o @ts-nocheck en código de runtime; usa tipado estricto, unknown o esquemas Zod',
  },
  {
    id: 'G-C13', sev: 'AVISO', files: (p) => isWeb(p) && isCode(p) && !isTest(p),
    re: /dangerouslySetInnerHTML/,
    msg: 'uso de dangerouslySetInnerHTML; prohibido para renderizar consignas o feedback por riesgo de XSS',
  },
];

// ---------------------------------------------------------------- reglas de archivo

function parsePrismaBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let cur = null;
  lines.forEach((l, i) => {
    const m = l.match(/^\s*(model|enum)\s+(\w+)\s*\{(.*)$/);
    if (m) {
      cur = { kind: m[1], name: m[2], line: i + 1, body: [] };
      const rest = m[3];
      if (rest.includes('}')) {
        const inner = rest.slice(0, rest.indexOf('}')).trim();
        if (inner) cur.body.push({ text: inner, line: i + 1 });
        blocks.push(cur);
        cur = null;
      }
    } else if (cur && /^\s*\}/.test(l)) {
      blocks.push(cur);
      cur = null;
    } else if (cur) cur.body.push({ text: l, line: i + 1 });
  });
  return blocks;
}

function prismaField(body, names) {
  return body.find((b) => new RegExp(`^\\s*(${names})\\s+\\S`).test(b.text));
}

function fileRules(file, text, ctx) {
  const out = [];
  const p = file.path;
  const add = (id, sev, line, msg) => out.push({ id, sev, line, msg });
  const lines = text.split('\n');
  const firstLine = (re) => lines.findIndex((l) => re.test(l)) + 1 || 1;

  if (isPrisma(p)) {
    for (const b of parsePrismaBlocks(text)) {
      if (b.kind === 'model') {
        if (ctx.tenantModels) {
          if (ctx.tenantModels.has(b.name)) {
            const f = b.body.find((x) => /^\s*organization_id\s+String\b(?!\?)/.test(x.text) || (/^\s*organizationId\s+String\b(?!\?)/.test(x.text) && /@map\(\s*"organization_id"\s*\)/.test(x.text)));
            if (!f) add('G-A05', 'ERROR', b.line, `el modelo de tenant ${b.name} no tiene organization_id directo y obligatorio`);
          } else if (b.name !== 'Organization') {
            add('G-A05', 'AVISO', b.line, `el modelo ${b.name} no está en la matriz de tenant de architecture §6.2: decide si es tenant y actualiza primero la planeación`);
          }
        }
        if (b.name === 'Review') {
          const f = prismaField(b.body, 'score|graded_at|gradedAt');
          if (f) add('G-A09', 'ERROR', f.line, 'Review no guarda nota: score y graded_at viven solo en Attempt (decisión 72)');
        }
        if (b.name === 'Student') {
          const f = prismaField(b.body, 'name');
          if (f) add('G-A09', 'ERROR', f.line, 'Student no tiene name: el nombre vive en User.name (decisión 79)');
        }
        if (b.name === 'Attempt') {
          const f = prismaField(b.body, 'score');
          if (f && !/@db\.Decimal\(\s*2\s*,\s*1\s*\)/.test(f.text)) add('G-A10', 'AVISO', f.line, 'Attempt.score debería ser @db.Decimal(2, 1) (numeric(2,1))');
        }
      } else if (b.kind === 'enum') {
        if (b.name === 'ApprovalStatus') {
          const f = b.body.find((x) => /\brejected\b/.test(x.text));
          if (f) add('G-A09', 'ERROR', f.line, 'ApprovalStatus no tiene rejected: rechazar borra la solicitud (decisión 77)');
        }
        if (b.name === 'Role') {
          const f = b.body.find((x) => /\bguardian\b/.test(x.text));
          if (f) add('G-A09', 'ERROR', f.line, 'Role no tiene guardian (decisión 35)');
        }
      }
    }
    if (/model\s+Attempt\b/.test(text) && ctx.migrationSql !== null && !/CHECK\s*\([^)]*score/i.test(ctx.migrationSql)) {
      add('G-A10', 'AVISO', firstLine(/model\s+Attempt\b/), 'no se encontró en las migraciones un CHECK sobre score (0 a 5)');
    }
  }

  if (/(^|\/)prisma\.config\.[cm]?[jt]s$/.test(p) && !/MIGRATION_DATABASE_URL/.test(text)) {
    add('G-A03', 'AVISO', firstLine(/datasource|url/), 'prisma.config no usa MIGRATION_DATABASE_URL: las migraciones van por la conexión directa de Neon');
  }
  if (/^\.github\/workflows\/.+\.ya?ml$/.test(p) && /migrate\s+deploy/.test(text) && !/MIGRATION_DATABASE_URL/.test(text)) {
    add('G-A03', 'AVISO', firstLine(/migrate\s+deploy/), 'el workflow ejecuta migrate deploy sin MIGRATION_DATABASE_URL');
  }
  if (/(^|\/)supabase\//.test(p)) add('G-A01', 'ERROR', 1, 'carpeta de Supabase en el repositorio');
  if (basename(p) === 'vercel.json') add('G-B01', 'ERROR', 1, 'vercel.json: Vercel no forma parte de la topología');

  if (isWeb(p) && /(^|\/)middleware\.[cm]?[jt]s$/.test(p)) add('G-B02', 'ERROR', 1, 'middleware.ts no se usa en Next.js 16: la intercepción vive en proxy.ts');
  if (isWeb(p) && /(^|\/)proxy\.[cm]?[jt]s$/.test(p)) {
    lines.forEach((l, i) => {
      if (/jwtVerify|jsonwebtoken|\.verify\(|@prisma\/client|organization_?id|organizationId/.test(l)) {
        add('G-B03', 'AVISO', i + 1, 'proxy.ts parece verificar o autorizar; solo debe redirigir por presencia de cookie o claim de rol');
      }
    });
  }
  if (isWeb(p) && /^apps\/web\/(src\/)?app\/(.*\/)?\(?(admin|parent)\)?\//.test(p)) {
    add('G-C05', 'ERROR', 1, 'pantallas de admin o parent fuera del piloto (enum completo, sin pantallas)');
  }
  if (isWeb(p) && /(^|\/)next\.config\.[cm]?[jt]s$/.test(p)) {
    if (!/cacheComponents\s*:\s*true/.test(text)) add('G-B04', 'AVISO', 1, 'next.config sin cacheComponents: true (modelo de caché explícito)');
    if (!/reactCompiler\s*:\s*true/.test(text)) add('G-B04', 'AVISO', 1, 'next.config sin reactCompiler: true');
  }
  if (isCode(p) && /^\s*['"]use cache['"]/m.test(text) && /\b(cookies|headers)\(\)|getSession|getCurrentUser|\bauth\(\)/.test(text)) {
    add('G-B04', 'ERROR', firstLine(/^\s*['"]use cache['"]/), '"use cache" junto a lectura de cookies, headers o sesión: nunca se cachean datos autenticados');
  }
  if (/(^|\/)wrangler\.(jsonc?|toml)$/.test(p)) {
    if (!/nodejs_compat/.test(text)) add('G-B06', 'ERROR', 1, 'wrangler sin la bandera nodejs_compat');
    const d = text.match(/compatibility_date["']?\s*[:=]\s*["'](\d{4}-\d{2}-\d{2})["']/);
    if (!d) add('G-B06', 'AVISO', 1, 'wrangler sin compatibility_date');
    else if (d[1] < '2024-09-23') add('G-B06', 'ERROR', firstLine(/compatibility_date/), `compatibility_date ${d[1]} es anterior a 2024-09-23`);
    if (!/["']?assets["']?\s*[:=]|\[assets\]/.test(text)) add('G-B06', 'AVISO', 1, 'wrangler sin configuración de assets');
  }
  if (/(^|\/)Dockerfile[^/]*$/.test(p) && (isApi(p) || !p.includes('/')) && !/ffmpeg/.test(text)) {
    add('G-B07', 'ERROR', 1, 'la imagen de la API no instala ffmpeg/ffprobe (transcodificación y medición de duración)');
  }
  if (/(^|\/)render\.ya?ml$/.test(p)) {
    lines.forEach((l, i) => {
      if (/numInstances\s*:\s*([2-9]|\d{2,})/.test(l)) add('G-B08', 'ERROR', i + 1, 'más de una instancia de la API (decisión 64)');
      if (/^\s*scaling\s*:/.test(l)) add('G-B08', 'ERROR', i + 1, 'autoescalado de la API (decisión 64)');
    });
    for (const block of text.split(/\n(?=\s*-\s+type\s*:)/)) {
      if (/name\s*:\s*\S*prod/i.test(block) && /plan\s*:\s*free\b/i.test(block)) {
        add('G-B12', 'AVISO', firstLine(/plan\s*:\s*free/i), 'servicio de producción en plan free: producción usa Render Starter siempre activo');
      }
    }
  }
  if (p === 'apps/api/src/main.ts') {
    const prefix = text.match(/setGlobalPrefix\(([^;]*)/s);
    if (!prefix) add('G-C07', 'AVISO', 1, 'main.ts no fija setGlobalPrefix("api/v1")');
    else {
      if (!/['"]\/?api\/v1['"]/.test(prefix[1])) add('G-C07', 'AVISO', firstLine(/setGlobalPrefix/), 'el prefijo global no es api/v1');
      if (!/health/.test(prefix[1]) || !/docs/.test(prefix[1])) add('G-C07', 'AVISO', firstLine(/setGlobalPrefix/), 'setGlobalPrefix no excluye health y docs (decisión 83)');
    }
    if (/SwaggerModule\.setup/.test(text) && !/APP_ENV|production/.test(text)) {
      add('G-C07', 'AVISO', firstLine(/SwaggerModule\.setup/), '/docs debe responder 404 en producción (APP_ENV === "production")');
    }
  }
  if (isApiSrc(p) && /@Cron\(/.test(text) && !/ScheduledJobRun|scheduledJobRun|JobRun/.test(text)) {
    add('G-C09', 'AVISO', firstLine(/@Cron\(/), 'tarea periódica sin registro en ScheduledJobRun (idempotencia tras reinicios)');
  }
  if (isCode(p) && /new\s+PrismaClient\(/.test(text) && !/answer_key|answerKey/.test(text)) {
    add('G-C04', 'AVISO', firstLine(/new\s+PrismaClient\(/), 'PrismaClient sin omit global de answer_key en este archivo');
  }
  if (/(^|\/)\.env(\.[\w-]+)?$/.test(p) && !/\.env\.(example|sample|template)$/.test(p)) {
    add('G-C11', 'ERROR', 1, 'archivo .env en el repositorio; solo se versiona .env.example sin valores');
  }
  return out;
}

// ---------------------------------------------------------------- supresiones

const IGNORE_RE = /guardrails-ignore\s+((?:G-[ABC]\d{2}[\s,]*)+)(?:[:—-]\s*)?(.*)$/;

function suppression(lines, idx, id) {
  for (const j of [idx, idx - 1]) {
    if (j < 0 || j >= lines.length) continue;
    const m = lines[j].match(IGNORE_RE);
    if (m && m[1].split(/[\s,]+/).includes(id)) {
      const reason = m[2].replace(/\*\/\s*$|-->\s*$/, '').trim();
      return { reason };
    }
  }
  return null;
}

// ---------------------------------------------------------------- ejecución

function scan(root, scope, planning) {
  const findings = [];
  const suppressed = [];
  let migrationSql = null;
  const needsMigrations = scope.files.some((f) => isPrisma(f.path));
  if (needsMigrations) {
    const useGit = isGitRepo(root);
    const migs = listRepoFiles(root, useGit).filter(isMigrationSql);
    migrationSql = migs.length ? migs.map((m) => readText(join(root, m))).join('\n') : null;
  }
  const ctx = { tenantModels: planning.tenantModels, migrationSql };

  for (const file of scope.files) {
    const abs = join(root, file.path);
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
    const text = readText(abs);
    if (text.includes('\u0000')) continue;
    const lines = text.split('\n');
    const record = (id, sev, line, msg) => {
      const sup = suppression(lines, line - 1, id);
      const item = { severity: sev, id, file: file.path, line, message: msg, source: RULES[id].source, excerpt: (lines[line - 1] ?? '').trim().slice(0, 160) };
      if (sup && sup.reason) suppressed.push({ ...item, reason: sup.reason });
      else {
        findings.push(item);
        if (sup) findings.push({ ...item, severity: 'AVISO', message: `supresión de ${id} sin motivo; añade "guardrails-ignore ${id}: motivo"` });
      }
    };

    const doc = isDoc(file.path);
    for (let i = 0; i < lines.length; i++) {
      if (file.added && !file.added.has(i + 1)) continue;
      // El texto del comentario de supresión (incluido su motivo) no se evalúa.
      const line = lines[i].replace(IGNORE_RE, '');
      for (const r of LINE_RULES) {
        if (doc && !r.docSev) continue;
        if (r.files && !r.files(file.path)) continue;
        if (!r.re.test(line)) continue;
        if (r.skip && r.skip(line)) continue;
        if (r.when && !r.when({ lines, i, path: file.path, text })) continue;
        record(r.id, doc ? r.docSev : r.sev, i + 1, r.msg);
      }
    }
    for (const f of fileRules(file, text, ctx)) record(f.id, f.sev, f.line, f.msg);
  }

  // Un mismo hallazgo (regla + archivo + línea) se informa una vez.
  const seen = new Set();
  const unique = findings.filter((f) => {
    const k = `${f.id}|${f.file}|${f.line}|${f.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  unique.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'ERROR' ? -1 : 1) || a.id.localeCompare(b.id) || a.file.localeCompare(b.file) || a.line - b.line);
  return { findings: unique, suppressed };
}

function selfCheck(root, planning) {
  const errs = [];
  const warns = [...planning.notes];
  const catalogPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'references', 'reglas.md');
  if (!existsSync(catalogPath)) fatal(`no se encontró ${catalogPath}`);
  const catalog = readText(catalogPath);
  const documented = new Map([...catalog.matchAll(/^### (G-[ABC]\d{2}) — (.+)$/gm)].map((m) => [m[1], m[2]]));
  for (const id of Object.keys(RULES)) if (!documented.has(id)) errs.push(`${id} está en el script pero no en references/reglas.md`);
  for (const id of documented.keys()) if (!RULES[id]) errs.push(`${id} está en references/reglas.md pero no en el script`);
  const used = new Set(LINE_RULES.map((r) => r.id));
  for (const id of ['G-A05', 'G-A10', 'G-B02', 'G-B03', 'G-B04', 'G-B06', 'G-B07', 'G-B08', 'G-B12', 'G-C04', 'G-C05', 'G-C07', 'G-C09', 'G-C11']) used.add(id);
  for (const id of Object.keys(RULES)) if (!used.has(id)) warns.push(`${id} no tiene ninguna comprobación automática (debería figurar como Manual en el catálogo)`);

  // Decisiones citadas en el catálogo: deben existir y no estar retiradas.
  const cited = new Set();
  for (const m of catalog.matchAll(/decisi(?:ón|ones)\s+([\d\s,y–\-()a-z]+)/gi)) {
    for (const r of m[1].matchAll(/(\d+)\s*[–-]\s*(\d+)|(\d+)/g)) {
      if (r[3]) cited.add(Number(r[3]));
      else for (let n = Number(r[1]); n <= Number(r[2]); n++) cited.add(n);
    }
  }
  for (const n of [...cited].sort((a, b) => a - b)) {
    if (n > 1000) continue;
    if (!planning.decisions.has(n)) errs.push(`references/reglas.md cita la decisión ${n}, que no existe en CONTEXT §14`);
    else if (/^(Sustituida|Retirada)/i.test(planning.decisions.get(n))) {
      warns.push(`references/reglas.md cita la decisión ${n}, marcada "${planning.decisions.get(n).slice(0, 60)}…": comprueba que la regla use su forma vigente`);
    }
  }
  if (planning.tenantModels) console.log(`Matriz de tenant leída de architecture §6.2: ${[...planning.tenantModels].join(', ')}`);
  console.log(`Decisiones en CONTEXT §14: ${planning.decisions.size} (máxima ${planning.maxDecision}; el script conoce hasta la ${KNOWN_MAX_DECISION}).`);
  console.log(`Reglas: ${Object.keys(RULES).length} en el script, ${documented.size} en el catálogo.`);
  for (const w of warns) console.log(`AVISO  ${w}`);
  for (const e of errs) console.log(`ERROR  ${e}`);
  console.log(errs.length ? `\nSelf-check: ${errs.length} error(es).` : '\nSelf-check: catálogo y script sincronizados.');
  process.exit(errs.length ? 1 : 0);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = opts.root ? resolve(opts.root) : findRoot(process.cwd());
  if (!root || !existsSync(join(root, '.agents', 'CONTEXT.md'))) fatal('no se encontró la raíz del repositorio (.agents/CONTEXT.md); usa --root');
  const planning = loadPlanning(root);
  if (opts.selfCheck) return selfCheck(root, planning);

  const scope = resolveScope(root, opts);
  const { findings, suppressed } = scan(root, scope, planning);
  const errors = findings.filter((f) => f.severity === 'ERROR').length;
  const warnings = findings.length - errors;
  const addedLines = scope.files.reduce((n, f) => n + (f.added ? f.added.size : 0), 0);

  if (opts.json) {
    console.log(JSON.stringify({ scope: scope.label, files: scope.files.length, addedLines, notes: planning.notes, findings, suppressed, stats: { errors, warnings, suppressed: suppressed.length } }, null, 2));
  } else {
    const extra = scope.files.some((f) => f.added) ? `, ${addedLines} líneas añadidas` : '';
    console.log(`englove-guardrails — alcance: ${scope.label} (${scope.files.length} archivos${extra})`);
    for (const n of planning.notes) console.log(`NOTA   ${n}`);
    if (!scope.files.length) console.log('No hay archivos de código o configuración en el alcance.');
    for (const f of findings) {
      console.log(`${f.severity.padEnd(6)} ${f.file}:${f.line}  [${f.id}] ${f.message} (${f.source})`);
      if (f.excerpt) console.log(`       > ${f.excerpt}`);
    }
    if (suppressed.length) {
      console.log('\nSuprimidos (revisa que el motivo sea válido):');
      for (const s of suppressed) console.log(`       ${s.file}:${s.line}  [${s.id}] ${s.reason}`);
    }
    console.log(`\nResumen: ${errors} error(es), ${warnings} aviso(s), ${suppressed.length} suprimido(s).`);
    console.log('Las reglas marcadas como Manual en references/reglas.md no las cubre este script: revísalas a mano.');
  }
  process.exit(errors ? 1 : 0);
}

main();
