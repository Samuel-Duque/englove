import { execFileSync } from 'child_process';

// guardrails-ignore G-A04: verificacion de compuerta CI que prohibe el comando (SPEC-01 RF-17)
try {
  const out = execFileSync(
    'git',
    [
      'grep',
      '-n',
      '-E',
      '\\bdb[[:space:]]+push\\b',
      '--',
      ':(exclude).agents/skills/*',
      ':(exclude).claude/skills/*',
      ':(exclude).kiro/skills/*',
      ':(exclude)*.md',
      ':(exclude).github/workflows/ci.yml',
      ':(exclude)scripts/check-no-db-push.mjs',
    ],
    { encoding: 'utf8' },
  );
  console.error('Forbidden db-push found:\n' + out);
  process.exit(1);
} catch (e) {
  if (e.status === 1) {
    console.log('OK: No forbidden db-push found');
    process.exit(0);
  } else {
    console.error('Error executing git grep:', e.message);
    process.exit(1);
  }
}
