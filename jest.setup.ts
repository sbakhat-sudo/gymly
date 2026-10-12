import fs from 'node:fs';
import path from 'node:path';

// Global Jest setup: replace native AsyncStorage with the official in-memory mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Unlike `expo start`/`expo export`, Jest never reads `.env` — load it by hand so
// `src/lib/supabase/client.ts` can construct its client (no real network call happens in tests).
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match?.[1] && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}
