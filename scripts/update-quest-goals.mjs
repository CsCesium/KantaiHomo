// Convert poi's versioned quest target data to the app's offline rule format.
// Usage: node scripts/update-quest-goals.mjs [local questgoal.json]
import fs from 'node:fs/promises';
const source = 'https://raw.githubusercontent.com/poooi/poi/master/assets/data/fcd/questgoal.json';
const payload = process.argv[2] ? JSON.parse(await fs.readFile(process.argv[2], 'utf8')) :
  await (await fetch(source)).json();
if (!payload.meta?.version || !payload.data) throw new Error('Invalid poi quest payload');
const quests = Object.entries(payload.data).map(([id, definition]) => ({
  id: Number(id), type: definition.type ?? 0, resetInterval: definition.resetInterval ?? 0,
  goals: Object.entries(definition).filter(([, goal]) => goal && typeof goal === 'object').map(([key, goal]) => ({
    key, event: key.split('@')[0], ...goal,
  })),
}));
await fs.writeFile(new URL('../entry/src/main/resources/rawfile/data/quest_goals.json', import.meta.url),
  JSON.stringify({ source, version: payload.meta.version, quests }) + '\n');
console.log(`Imported ${quests.length} quest definitions (${payload.meta.version})`);
