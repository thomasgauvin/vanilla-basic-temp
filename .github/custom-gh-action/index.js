const core = require('@actions/core');
const exec = require('@actions/exec');
const cache = require('@actions/cache');

async function run() {
  try {
    // Define the Docker image name and tag
    const imageName = 'hello-world';
    const imageTag = 'latest';

    // Define the Docker image cache key
    const cacheKey = `docker-${imageName}-${imageTag}`;

    // Check if the Docker image is already cached
    const cachedPath = await cache.restoreCache([`/tmp/${imageName}`], cacheKey);
    if (cachedPath && cachedPath.length) {
      core.info(`Using Docker image cache: ${cachedPath}`);
    } else {
      // Pull the Docker image
      await exec.exec(`docker pull ${imageName}:${imageTag}`);

      // Save the Docker image to a path
      await exec.exec(`docker save -o /tmp/${imageName} ${imageName}:${imageTag}`);

      // Cache the Docker image path
      await cache.saveCache([`/tmp/${imageName}`], cacheKey);
    }

    // Run the Docker container
    await exec.exec(`docker run ${imageName}:${imageTag}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
