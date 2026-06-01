#!/usr/bin/env node
/**
 * kg.js — Knowledge Graph CLI for Claude project memory
 *
 * Storage: pure JSONL files, no SQLite
 *   kg/entities.jsonl  — one entity per line (with embedded observations[])
 *   kg/relations.jsonl — one directed relation per line
 *
 * Horizon (lifespan of an entity):
 *   ephemeral  — current task/session only; pruned at phase-close
 *   phase      — survives until superseded or end of phase cycle (default)
 *   permanent  — core knowledge; never auto-pruned
 *
 * Usage:
 *   node scripts/kg.js add-entity --type decision --id "auth-jwt" --name "..." [--horizon permanent]
 *   node scripts/kg.js add-obs "decision:auth-jwt" --type fact --text "..."
 *   node scripts/kg.js add-rel --from "task:x" --rel "touches" --to "module:auth"
 *   node scripts/kg.js promote "task:x" --to phase
 *   node scripts/kg.js prune [--horizon ephemeral]
 *   node scripts/kg.js get "decision:auth-jwt"
 *   node scripts/kg.js list [--type task] [--horizon ephemeral] [--status active]
 *   node scripts/kg.js search "JWT"
 *   node scripts/kg.js related "module:auth"
 *   node scripts/kg.js context "auth JWT login"
 *   node scripts/kg.js stats
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const KG_DIR = path.join(process.cwd(), 'kg');
const ENTITIES_FILE = path.join(KG_DIR, 'entities.jsonl');
const RELATIONS_FILE = path.join(KG_DIR, 'relations.jsonl');

const VALID_ENTITY_TYPES = ['task', 'document', 'decision', 'pattern', 'module', 'issue'];
const VALID_OBS_TYPES = ['fact', 'status-change', 'blocker', 'link'];
const VALID_REL_TYPES = ['touches', 'depends-on', 'implements', 'related-to', 'supersedes', 'caused-by'];
const VALID_HORIZONS = ['ephemeral', 'phase', 'permanent'];

// Default horizon per entity type
const DEFAULT_HORIZON = {
  task:     'ephemeral',
  issue:    'ephemeral',
  decision: 'phase',
  pattern:  'phase',
  document: 'permanent',
  module:   'permanent',
};

// ---------------------------------------------------------------------------
// File I/O helpers
// ---------------------------------------------------------------------------

function ensureKgDir() {
  if (!fs.existsSync(KG_DIR)) fs.mkdirSync(KG_DIR, { recursive: true });
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function appendJsonl(filePath, record) {
  ensureKgDir();
  fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf8');
}

function rewriteJsonl(filePath, records) {
  ensureKgDir();
  fs.writeFileSync(filePath, records.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Entity operations
// ---------------------------------------------------------------------------

function loadEntities() {
  return readJsonl(ENTITIES_FILE);
}

function findEntity(id) {
  return loadEntities().find(e => e.id === id) || null;
}

function saveEntityUpdate(entity) {
  const entities = loadEntities();
  const idx = entities.findIndex(e => e.id === entity.id);
  if (idx === -1) {
    appendJsonl(ENTITIES_FILE, entity);
  } else {
    const updated = [...entities];
    updated[idx] = entity;
    rewriteJsonl(ENTITIES_FILE, updated);
  }
}

function buildEntityId(type, rawId) {
  if (rawId.includes(':')) return rawId;
  return `${type}:${rawId}`;
}

// ---------------------------------------------------------------------------
// Command: add-entity
// ---------------------------------------------------------------------------

function cmdAddEntity(args) {
  const type    = getArg(args, '--type');
  const rawId   = getArg(args, '--id');
  const name    = getArg(args, '--name');
  const status  = getArg(args, '--status') || 'active';
  const horizon = getArg(args, '--horizon') || DEFAULT_HORIZON[type] || 'phase';

  if (!type || !rawId || !name) {
    die('Usage: add-entity --type <type> --id <id> --name <name> [--horizon ephemeral|phase|permanent]');
  }
  if (!VALID_ENTITY_TYPES.includes(type)) {
    die(`Invalid type "${type}". Valid: ${VALID_ENTITY_TYPES.join(', ')}`);
  }
  if (!VALID_HORIZONS.includes(horizon)) {
    die(`Invalid horizon "${horizon}". Valid: ${VALID_HORIZONS.join(', ')}`);
  }

  const id = buildEntityId(type, rawId);
  if (findEntity(id)) die(`Entity "${id}" already exists. Use add-obs to add observations.`);

  const entity = {
    id, type, name, status, horizon,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    observations: [],
  };

  saveEntityUpdate(entity);
  console.log(`✓ Created entity: ${id} [${horizon}]`);
}

// ---------------------------------------------------------------------------
// Command: add-obs
// ---------------------------------------------------------------------------

function cmdAddObs(args) {
  const id      = args[0] && !args[0].startsWith('--') ? args[0] : getArg(args, '--id');
  const obsType = getArg(args, '--type');
  const text    = getArg(args, '--text');
  const from    = getArg(args, '--from');
  const to      = getArg(args, '--to');

  if (!id || !obsType) die('Usage: add-obs <entity-id> --type <obs-type> --text <text>');
  if (!VALID_OBS_TYPES.includes(obsType)) {
    die(`Invalid obs type "${obsType}". Valid: ${VALID_OBS_TYPES.join(', ')}`);
  }

  const entity = findEntity(id);
  if (!entity) die(`Entity "${id}" not found.`);

  const obs = { type: obsType, at: new Date().toISOString() };
  if (obsType === 'status-change') {
    if (!from || !to) die('status-change requires --from and --to');
    obs.from = from;
    obs.to = to;
    entity.status = to;
  } else if (obsType === 'link') {
    if (!text) die('link observation requires --text (the URL or reference)');
    obs.url = text;
  } else {
    if (!text) die('--text is required');
    obs.text = text;
  }

  saveEntityUpdate({
    ...entity,
    observations: [...entity.observations, obs],
    updated_at: new Date().toISOString(),
  });
  console.log(`✓ Added ${obsType} observation to ${id}`);
}

// ---------------------------------------------------------------------------
// Command: promote
// ---------------------------------------------------------------------------

function cmdPromote(args) {
  const id = args[0];
  const to = getArg(args, '--to');

  if (!id || !to) die('Usage: promote <entity-id> --to <horizon>');
  if (!VALID_HORIZONS.includes(to)) die(`Invalid horizon "${to}". Valid: ${VALID_HORIZONS.join(', ')}`);

  const entity = findEntity(id);
  if (!entity) die(`Entity "${id}" not found.`);

  const order = { ephemeral: 0, phase: 1, permanent: 2 };
  if (order[to] <= order[entity.horizon || 'phase']) {
    die(`Cannot demote: "${id}" is already at horizon "${entity.horizon}". Use prune to remove.`);
  }

  const obs = {
    type: 'fact',
    text: `Promoted from ${entity.horizon} → ${to}`,
    at: new Date().toISOString(),
  };

  saveEntityUpdate({
    ...entity,
    horizon: to,
    observations: [...entity.observations, obs],
    updated_at: new Date().toISOString(),
  });
  console.log(`✓ Promoted ${id}: ${entity.horizon} → ${to}`);
}

// ---------------------------------------------------------------------------
// Command: prune
// ---------------------------------------------------------------------------

function cmdPrune(args) {
  const horizonFilter = getArg(args, '--horizon') || 'ephemeral';
  const dryRun = args.includes('--dry-run');

  const entities = loadEntities();
  const relations = readJsonl(RELATIONS_FILE);

  // Entities to remove
  const toRemove = new Set(
    entities
      .filter(e => e.horizon === horizonFilter || e.status === 'archived')
      .map(e => e.id)
  );

  // Orphaned relations (either side missing)
  const entityIds = new Set(entities.map(e => e.id));
  const orphanedRels = relations.filter(r => !entityIds.has(r.from) || !entityIds.has(r.to));

  // Relations touching pruned entities
  const affectedRels = relations.filter(r => toRemove.has(r.from) || toRemove.has(r.to));

  const totalRels = orphanedRels.length + affectedRels.length;

  if (toRemove.size === 0 && totalRels === 0) {
    console.log('Nothing to prune.');
    return;
  }

  console.log(`\nPrune preview (horizon: ${horizonFilter}):`);
  console.log(`  Entities to remove: ${toRemove.size}`);
  [...toRemove].forEach(id => console.log(`    - ${id}`));
  console.log(`  Relations to remove: ${totalRels}`);

  if (dryRun) {
    console.log('\n(dry-run — no changes made)');
    return;
  }

  // Execute
  const keptEntities = entities.filter(e => !toRemove.has(e.id));
  const keptRelIds = new Set(keptEntities.map(e => e.id));
  const keptRelations = relations.filter(r =>
    !toRemove.has(r.from) && !toRemove.has(r.to) &&
    keptRelIds.has(r.from) && keptRelIds.has(r.to)
  );

  rewriteJsonl(ENTITIES_FILE, keptEntities);
  rewriteJsonl(RELATIONS_FILE, keptRelations);

  console.log(`\n✓ Pruned ${toRemove.size} entities, ${totalRels} relations.`);
}

// ---------------------------------------------------------------------------
// Command: add-rel
// ---------------------------------------------------------------------------

function cmdAddRel(args) {
  const from = getArg(args, '--from');
  const rel  = getArg(args, '--rel');
  const to   = getArg(args, '--to');

  if (!from || !rel || !to) die('Usage: add-rel --from <id> --rel <rel-type> --to <id>');
  if (!VALID_REL_TYPES.includes(rel)) {
    die(`Invalid relation "${rel}". Valid: ${VALID_REL_TYPES.join(', ')}`);
  }
  if (!findEntity(from)) die(`Entity "${from}" not found.`);
  if (!findEntity(to)) die(`Entity "${to}" not found.`);

  const relations = readJsonl(RELATIONS_FILE);
  if (relations.find(r => r.from === from && r.rel === rel && r.to === to)) {
    console.log(`(already exists: ${from} --${rel}--> ${to})`);
    return;
  }

  appendJsonl(RELATIONS_FILE, { from, rel, to, at: new Date().toISOString() });
  console.log(`✓ Relation: ${from} --${rel}--> ${to}`);
}

// ---------------------------------------------------------------------------
// Command: get
// ---------------------------------------------------------------------------

function cmdGet(args) {
  const id = args[0];
  if (!id) die('Usage: get <entity-id>');

  const entity = findEntity(id);
  if (!entity) die(`Entity "${id}" not found.`);

  const relations = readJsonl(RELATIONS_FILE);
  const outgoing  = relations.filter(r => r.from === id);
  const incoming  = relations.filter(r => r.to === id);

  console.log(`\n## ${entity.id} (${entity.type}) [${entity.horizon || 'phase'}]`);
  console.log(`Name:    ${entity.name}`);
  console.log(`Status:  ${entity.status}`);
  console.log(`Created: ${entity.created_at}`);

  if (entity.observations.length > 0) {
    console.log('\n### Observations');
    for (const obs of entity.observations) {
      const t = obs.at.slice(0, 16);
      if (obs.type === 'status-change') {
        console.log(`  [${t}] status-change: ${obs.from} → ${obs.to}`);
      } else if (obs.type === 'link') {
        console.log(`  [${t}] link: ${obs.url}`);
      } else {
        console.log(`  [${t}] ${obs.type}: ${obs.text}`);
      }
    }
  }

  if (outgoing.length > 0) {
    console.log('\n### Relations (outgoing)');
    for (const r of outgoing) console.log(`  --${r.rel}--> ${r.to}`);
  }
  if (incoming.length > 0) {
    console.log('\n### Relations (incoming)');
    for (const r of incoming) console.log(`  ${r.from} --${r.rel}-->`);
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Command: list
// ---------------------------------------------------------------------------

function cmdList(args) {
  const typeFilter    = getArg(args, '--type');
  const statusFilter  = getArg(args, '--status');
  const horizonFilter = getArg(args, '--horizon');

  let entities = loadEntities();
  if (typeFilter)    entities = entities.filter(e => e.type === typeFilter);
  if (statusFilter)  entities = entities.filter(e => e.status === statusFilter);
  if (horizonFilter) entities = entities.filter(e => (e.horizon || 'phase') === horizonFilter);

  if (entities.length === 0) { console.log('(no entities match)'); return; }

  for (const e of entities) {
    const h = (e.horizon || 'phase').padEnd(10);
    console.log(`${e.id.padEnd(40)} [${h}] [${e.status}] ${e.name}`);
  }
}

// ---------------------------------------------------------------------------
// Command: search
// ---------------------------------------------------------------------------

function cmdSearch(args) {
  const query = args[0];
  if (!query) die('Usage: search <query>');

  const terms   = query.toLowerCase().split(/\s+/);
  const results = loadEntities().filter(e =>
    terms.every(t => JSON.stringify(e).toLowerCase().includes(t))
  );

  if (results.length === 0) { console.log(`(no results for "${query}")`); return; }

  console.log(`\nFound ${results.length} result(s) for "${query}":\n`);
  for (const e of results) {
    console.log(`  ${e.id} [${e.horizon || 'phase'}] — ${e.name} [${e.status}]`);
    const matchingObs = e.observations.filter(o => {
      const text = (o.text || o.url || `${o.from}→${o.to}`).toLowerCase();
      return terms.some(t => text.includes(t));
    });
    for (const o of matchingObs) {
      console.log(`    · ${o.type}: ${o.text || o.url || `${o.from} → ${o.to}`}`);
    }
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Command: related
// ---------------------------------------------------------------------------

function cmdRelated(args) {
  const id = args[0];
  if (!id) die('Usage: related <entity-id>');

  const entity    = findEntity(id);
  if (!entity) die(`Entity "${id}" not found.`);

  const relations = readJsonl(RELATIONS_FILE);
  const entities  = loadEntities();
  const outgoing  = relations.filter(r => r.from === id);
  const incoming  = relations.filter(r => r.to === id);

  if (!outgoing.length && !incoming.length) {
    console.log(`No relations found for "${id}"`); return;
  }

  console.log(`\n## Related to ${id}\n`);
  for (const r of outgoing) {
    const target = entities.find(e => e.id === r.to);
    console.log(`  --${r.rel}--> ${r.to} (${target ? target.name : '?'})`);
  }
  for (const r of incoming) {
    const source = entities.find(e => e.id === r.from);
    console.log(`  ${r.from} (${source ? source.name : '?'}) --${r.rel}-->`);
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Command: context  (agent-friendly summary, excludes ephemeral by default)
// ---------------------------------------------------------------------------

function cmdContext(args) {
  const query      = args[0] || '';
  const terms      = query.toLowerCase().split(/\s+/).filter(Boolean);
  const allHorizons = args.includes('--all');

  let entities = loadEntities();

  // By default exclude ephemeral from context injection — they're too noisy
  if (!allHorizons) {
    entities = entities.filter(e => (e.horizon || 'phase') !== 'ephemeral');
  }

  let scored = entities.map(entity => {
    const haystack = JSON.stringify(entity).toLowerCase();
    const score = terms.filter(t => haystack.includes(t)).length;
    return { entity, score };
  });

  if (terms.length > 0) scored = scored.filter(s => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 8).map(s => s.entity);

  if (top.length === 0) { console.log('(no relevant kg context)'); return; }

  const relations = readJsonl(RELATIONS_FILE);
  const lines     = ['### Knowledge Graph Context\n'];

  for (const e of top) {
    lines.push(`**${e.id}** (${e.type}, ${e.horizon || 'phase'}): ${e.name}`);
    for (const o of e.observations.slice(-3)) {
      if (o.type === 'status-change') lines.push(`  - ${o.from} → ${o.to}`);
      else lines.push(`  - ${o.type}: ${o.text || o.url}`);
    }
    const rels = relations.filter(r => r.from === e.id || r.to === e.id).slice(0, 2);
    for (const r of rels) lines.push(`  - ${r.from} --${r.rel}--> ${r.to}`);
  }

  console.log(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Command: stats
// ---------------------------------------------------------------------------

function cmdStats() {
  const entities  = loadEntities();
  const relations = readJsonl(RELATIONS_FILE);

  const byType    = {};
  const byHorizon = { ephemeral: 0, phase: 0, permanent: 0 };

  for (const e of entities) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    const h = e.horizon || 'phase';
    byHorizon[h] = (byHorizon[h] || 0) + 1;
  }

  console.log(`\nKnowledge Graph Stats`);
  console.log(`  Entities:  ${entities.length}`);
  console.log(`  Relations: ${relations.length}`);
  console.log(`\n  By horizon:`);
  for (const [h, count] of Object.entries(byHorizon)) {
    console.log(`    ${h.padEnd(12)} ${count}`);
  }
  console.log(`\n  By type:`);
  for (const [type, count] of Object.entries(byType)) {
    console.log(`    ${type.padEnd(12)} ${count}`);
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Arg parsing helpers
// ---------------------------------------------------------------------------

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function die(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// State Machine commands (sm-*)
// ---------------------------------------------------------------------------

function cmdSmInit(args) {
  const taskId   = args[0] || null;
  const taskName = args.slice(1).join(' ') || 'Current task';

  // Xóa entity cũ nếu có (reset)
  const entities = loadEntities().filter(e => e.id !== 'task:sm-current');
  rewriteJsonl(ENTITIES_FILE, entities);

  const entity = {
    id: 'task:sm-current',
    type: 'task',
    name: taskName,
    status: 'discover',
    horizon: 'ephemeral',
    task_id: taskId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    observations: [],
  };
  ensureKgDir();
  appendJsonl(ENTITIES_FILE, entity);
  console.log(`✅ SM initialized. Task: ${taskName} | Phase: discover`);
}

function cmdSmPhase() {
  const entity = findEntity('task:sm-current');
  if (!entity) {
    process.stdout.write('discover\n'); // fail-open: chưa init → assume discover
    return;
  }
  process.stdout.write(entity.status + '\n');
}

function cmdSmTransition(args) {
  const from = getArg(args, '--from');
  const to   = getArg(args, '--to');

  if (!from || !to) die('Usage: sm-transition --from <phase> --to <phase>');

  const entity = findEntity('task:sm-current');
  if (!entity) die('SM chưa init. Chạy: node scripts/kg.js sm-init');

  if (entity.status !== from) {
    die(`Phase hiện tại là "${entity.status}", không phải "${from}". Không thể chuyển sang "${to}".`);
  }

  const obs = { type: 'status-change', from, to, at: new Date().toISOString() };
  saveEntityUpdate({
    ...entity,
    status: to,
    observations: [...entity.observations, obs],
    updated_at: new Date().toISOString(),
  });
  console.log(`✅ Phase: ${from} → ${to}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [, , command, ...rest] = process.argv;

switch (command) {
  case 'add-entity':    cmdAddEntity(rest); break;
  case 'add-obs':       cmdAddObs(rest); break;
  case 'add-rel':       cmdAddRel(rest); break;
  case 'promote':       cmdPromote(rest); break;
  case 'prune':         cmdPrune(rest); break;
  case 'get':           cmdGet(rest); break;
  case 'list':          cmdList(rest); break;
  case 'search':        cmdSearch(rest); break;
  case 'related':       cmdRelated(rest); break;
  case 'context':       cmdContext(rest); break;
  case 'stats':         cmdStats(); break;
  case 'sm-init':       cmdSmInit(rest); break;
  case 'sm-phase':      cmdSmPhase(); break;
  case 'sm-transition': cmdSmTransition(rest); break;
  default:
    console.log(`Knowledge Graph CLI

Commands:
  add-entity    --type <type> --id <id> --name <name> [--horizon ephemeral|phase|permanent]
  add-obs       <entity-id> --type <obs-type> --text <text>
  add-rel       --from <id> --rel <rel-type> --to <id>
  promote       <entity-id> --to <horizon>        # nâng horizon lên
  prune         [--horizon ephemeral] [--dry-run] # xóa entities theo horizon
  get           <entity-id>
  list          [--type <type>] [--horizon <h>] [--status <status>]
  search        <query terms>
  related       <entity-id>
  context       [query] [--all]   # --all bao gồm ephemeral
  stats
  sm-init       [task-id] [task-name]          # reset SM state, phase = discover
  sm-phase                                     # print current phase (1 line)
  sm-transition --from <phase> --to <phase>    # validate + transition phase

Horizons:    ephemeral → phase → permanent
  ephemeral  task/issue hiện tại — pruned at phase-close
  phase      decision/pattern của phase — default
  permanent  module/document — không bao giờ auto-prune

Entity types: ${VALID_ENTITY_TYPES.join(', ')}
Rel types:    ${VALID_REL_TYPES.join(', ')}
`);
}
