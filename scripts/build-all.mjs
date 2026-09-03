import { execFileSync } from 'node:child_process';

const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run build'] : ['run', 'build'];
execFileSync(command, args, { stdio: 'inherit' });
