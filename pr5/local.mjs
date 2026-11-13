import { mkdir } from 'node:fs/promises';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = process.env.CONTACTS_DB_PATH || fileURLToPath(
  new URL('./.mongo-data/', import.meta.url)
);
await mkdir(directory, { recursive: true });
const mongo = await MongoMemoryServer.create({
  instance: {
    dbPath: directory,
    args: ['--setParameter', 'diagnosticDataCollectionEnabled=false',
      ...(process.platform === 'win32' ? [] : ['--nounixsocket'])]
  }
});
const server = spawn(process.execPath, ['pr5/server.mjs'], {
  stdio: 'inherit', env: { ...process.env, MONGODB_URI: mongo.getUri() }
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.kill('SIGTERM'));
}
server.once('exit', async code => {
  await mongo.stop();
  process.exitCode = code ?? 0;
});
