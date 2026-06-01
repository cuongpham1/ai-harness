#!/usr/bin/env node
/**
 * PreToolUse hook — chạy trước khi PM dùng Agent tool
 * Block nếu phase hiện tại không cho phép spawn agent đó
 * Đọc state từ KG qua: node scripts/kg.js sm-phase
 */

const { execSync } = require('child_process');

// Map: agent keyword → phase được phép
const PHASE_GATES = {
  'coder':         'implement',
  'debugger':      'implement',
  'spec-reviewer': 'review',
  'reviewer':      'review',
};

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input);
    if (event.tool_name !== 'Agent') process.exit(0);

    const subagentType = (event.tool_input?.subagent_type || '').toLowerCase();

    // Tìm gate cho agent này
    const entry = Object.entries(PHASE_GATES).find(([agent]) => subagentType.includes(agent));
    if (!entry) process.exit(0); // agent không cần gate

    const requiredPhase = entry[1];

    // Đọc phase từ KG
    let phase;
    try {
      phase = execSync('node scripts/kg.js sm-phase', {
        encoding: 'utf8',
        timeout: 5000,
      }).trim();
    } catch {
      process.exit(0); // fail open nếu KG lỗi
    }

    // Check blocked (có blocker obs không?)
    let isBlocked = false;
    let blockerReason = '';
    try {
      const raw = execSync('node scripts/kg.js get "task:sm-current"', {
        encoding: 'utf8',
        timeout: 5000,
      });
      isBlocked = raw.includes('blocker:');
      if (isBlocked) {
        const match = raw.match(/blocker: (.+)/);
        blockerReason = match ? match[1] : 'unknown';
      }
    } catch { /* ignore */ }

    if (isBlocked) {
      return block(`Pipeline BLOCKED: ${blockerReason}`);
    }

    // Check phase
    if (phase !== requiredPhase) {
      return block(
        `Phase hiện tại là "${phase}", cần "${requiredPhase}" để spawn ${subagentType}.\n` +
        `Chạy /end-${phase} khi xong phase này.`
      );
    }

    process.exit(0); // allow

  } catch (err) {
    process.stderr.write(`[check-sm-clearance] Error: ${err.message}\n`);
    process.exit(0); // fail open
  }
});

function block(message) {
  process.stdout.write(JSON.stringify({ type: 'block', message: `🚫 Phase Gate: ${message}` }));
  process.exit(0);
}
