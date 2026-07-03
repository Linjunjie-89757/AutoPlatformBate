import { spawnSync } from 'node:child_process';

const mysqlArgs = [
  'exec',
  '-i',
  'auto-platform-mysql',
  'mysql',
  '--default-character-set=utf8mb4',
  '-uauto_user',
  '-pauto123456',
  'auto_platform',
  '-B',
  '-N',
];

function mysql(sql) {
  const result = spawnSync('docker', mysqlArgs, {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `mysql exited with ${result.status}`);
  }
  return result.stdout.trim();
}

function sqlString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

const rows = mysql("SELECT id, REPLACE(TO_BASE64(steps_json), '\\n', '') FROM tb_api_scenario WHERE id IN (31,32);")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const index = line.indexOf('\t');
    return {
      id: Number(line.slice(0, index)),
      stepsJson: Buffer.from(line.slice(index + 1), 'base64').toString('utf8'),
    };
  });

const statements = [];
for (const row of rows) {
  const steps = JSON.parse(row.stepsJson);
  for (const step of steps) {
    const rawText = step?.requestConfig?.body?.rawText;
    if (!rawText) {
      continue;
    }
    const body = JSON.parse(rawText);
    if (Object.prototype.hasOwnProperty.call(body, 'equityStatus') && body.equityStatus === 0) {
      body.equityStatus = 2;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'couponStatus') && body.couponStatus === 0) {
      body.couponStatus = 2;
    }
    step.requestConfig.body.rawText = JSON.stringify(body, null, 2);
  }
  statements.push(
    `UPDATE tb_api_scenario SET steps_json = ${sqlString(JSON.stringify(steps))}, updated_at = CURRENT_TIMESTAMP WHERE id = ${row.id};`,
  );
}

if (statements.length) {
  mysql(`START TRANSACTION;\n${statements.join('\n')}\nCOMMIT;`);
}

console.log(`updated ${statements.length} scenario(s)`);
