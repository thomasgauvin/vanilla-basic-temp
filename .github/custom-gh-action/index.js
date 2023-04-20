const exec = require('@actions/exec');

async function run() {
  try {
    await exec.exec('docker', ['run', 'hello-world']);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

run();
