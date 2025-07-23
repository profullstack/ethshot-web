// Browser-compatible pino logger stub
// This provides a minimal interface that WalletConnect expects

const noop = () => {};

const createLogger = () => ({
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  fatal: noop,
  child: () => createLogger(),
  level: 'info',
  levels: {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60
  }
});

// Default export (what pino() returns)
const pino = () => createLogger();

// Named exports
export { pino as default };
export const levels = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};