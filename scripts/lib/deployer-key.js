/**
 * The deployer wallet key, for the moment a script signs and no longer.
 *
 * Fleet rule (2026-10-28, after the dev2 wallet drain): a private key is never
 * read from the environment, a .env file or a command-line argument. It comes
 * from, in order:
 *
 *   1. the logicsrc keyring, when DEPLOYER_KEYRING names an entry
 *      (`logicsrc keyring add <file> --name <entry> --type generic`):
 *      `logicsrc keyring restore <entry> --print-private`, which asks for the
 *      keyring passphrase on the terminal;
 *   2. a hidden prompt on the terminal.
 *
 * A PRIVATE_KEY still in the environment is refused, so a stale .env cannot
 * quietly keep working. Nothing here writes the key anywhere.
 */
import { execFileSync } from 'node:child_process';
import { closeSync, openSync, readSync, writeSync } from 'node:fs';

let cached = null;

function normalize(raw) {
  const text = String(raw ?? '').trim();
  const m = /(?:0x)?([0-9a-fA-F]{64})/.exec(text);
  if (!m) throw new Error('That is not a 32-byte hex private key.');
  return `0x${m[1]}`;
}

function fromKeyring(entry) {
  const out = execFileSync('logicsrc', ['keyring', 'restore', entry, '--print-private'], {
    stdio: ['inherit', 'pipe', 'inherit'],
    encoding: 'utf8',
  });
  return normalize(out);
}

function fromPrompt() {
  let fd;
  try {
    fd = openSync('/dev/tty', 'r+');
  } catch {
    throw new Error('No terminal to ask for the deployer key on. Set DEPLOYER_KEYRING to a logicsrc keyring entry.');
  }
  try {
    writeSync(fd, 'Deployer private key (hidden): ');
    try {
      execFileSync('stty', ['-echo'], { stdio: [fd, 'ignore', 'ignore'] });
    } catch {
      // no stty: the key will echo, but it still never touches env or disk
    }
    let line = '';
    const buf = Buffer.alloc(1);
    while (readSync(fd, buf, 0, 1, null) === 1) {
      const ch = buf.toString('utf8');
      if (ch === '\n' || ch === '\r') break;
      line += ch;
    }
    try {
      execFileSync('stty', ['echo'], { stdio: [fd, 'ignore', 'ignore'] });
    } catch {
      // ignore
    }
    writeSync(fd, '\n');
    return normalize(line);
  } finally {
    closeSync(fd);
  }
}

/** Resolve the deployer key once per process (keyring, else prompt). Never from env. */
export function deployerKey() {
  if (cached) return cached;
  if (process.env.PRIVATE_KEY) {
    throw new Error(
      'PRIVATE_KEY is set in the environment (or .env). It is no longer read: remove it, and store the key with ' +
        '`logicsrc keyring add <file> --name <entry> --type generic` then set DEPLOYER_KEYRING=<entry>, or type it at the prompt.',
    );
  }
  const entry = process.env.DEPLOYER_KEYRING;
  cached = entry ? fromKeyring(entry) : fromPrompt();
  return cached;
}

/** Networks that sign with the deployer key; everything else (hardhat, localhost) never asks. */
export const LIVE_NETWORKS = ['sepolia', 'mainnet', 'base', 'arbitrum'];

/** The network this hardhat process was started for. */
export function selectedNetwork(argv = process.argv, env = process.env) {
  if (env.HARDHAT_NETWORK) return env.HARDHAT_NETWORK;
  const i = argv.indexOf('--network');
  return i >= 0 ? argv[i + 1] : undefined;
}

/** `accounts` for a hardhat network: the key only when that network is the one being used. */
export function accountsFor(network) {
  return selectedNetwork() === network ? [deployerKey()] : [];
}
