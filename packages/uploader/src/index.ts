import { spawn } from 'node:child_process';

function splitLane(lane) {
  return String(lane || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export async function runFastlaneLane({ lane, cwd, onLog }) {
  return new Promise((resolve, reject) => {
    const args = splitLane(lane);
    const child = spawn('fastlane', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let logs = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      logs += text;
      if (onLog) onLog(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      logs += text;
      if (onLog) onLog(text);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`fastlane exited with code ${code}`));
        return;
      }
      resolve(logs);
    });
  });
}

export async function uploadWithFastlane({ exportDir, uploadConfig, onLog }) {
  const results = [];

  if (uploadConfig?.iosLane) {
    const logs = await runFastlaneLane({ lane: uploadConfig.iosLane, cwd: exportDir, onLog });
    results.push({ platform: 'ios', logs });
  }

  if (uploadConfig?.androidLane) {
    const logs = await runFastlaneLane({ lane: uploadConfig.androidLane, cwd: exportDir, onLog });
    results.push({ platform: 'android', logs });
  }

  return results;
}
