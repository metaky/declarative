import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const childProcesses = [
  spawn(npmCommand, ['run', 'dev:api'], { stdio: 'inherit' }),
  spawn(npmCommand, ['run', 'dev:client'], { stdio: 'inherit' }),
];

const shutdown = (signal) => {
  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
};

for (const child of childProcesses) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown('SIGTERM');
      process.exit(code);
    }
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    shutdown(signal);
    process.exit(0);
  });
}
