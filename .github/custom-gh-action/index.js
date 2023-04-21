const core = require('@actions/core');
const exec = require('@actions/exec');
const cache = require('@actions/cache');
const fs = require('fs');
const path = require('path');

const appLocationInputName = 'app_location';
const appBuildCommandInputName = 'app_build_command';
const outputLocationInputName = 'output_location';
const apiLocationInputName = 'api_location';
const apiBuildCommandInputName = 'api_build_command';
const routesLocationInputName = 'routes_location';
const buildTimeoutInMinutesInputName = 'build_timeout_in_minutes';
const configFileLocationInputName = 'config_file_location';
const apiTokenInputName = 'azure_static_web_apps_api_token';
const deploymentEnvironmentInputName = 'deployment_environment';
const productionBranchInputName = 'production_branch';
const dataApiLocationInputName = 'data_api_location';

async function run() {
  try {

    const envVarFilePath = path.join(__dirname, 'env.list');
        
    await createDockerEnvVarFile(envVarFilePath);    
    
    // Define the Docker image name and tag
    const imageName = 'mcr.microsoft.com/appsvc/staticappsclient';
    const imageTag = 'stable';

    await loadDockerContainerFromCacheOrPullAndCache(imageName, imageTag);

    await runCachedDocker(envVarFilePath);

  } catch (error) {
    core.setFailed(error.message);
  }
}

async function createDockerEnvVarFile(envVarFilePath) {
  var variableString = ""

  const systemVariableNames = new Set();

  const addVariableToString = (envVarName, envVarValue) => variableString += `${envVarName}=${envVarValue}\n`;

  const addSystemVariableToString = (envVarName, envVarValue) => {
      addVariableToString(envVarName, envVarValue)
      systemVariableNames.add(envVarName)
  }

  const addInputStringToString = (envVarName, envVarValue, inputName,) => {
      if (envVarValue.includes("\n")) {
          throw "Input " + inputName + " is a multiline string and cannot be added to the build environment.";
      }

      addSystemVariableToString(envVarName, envVarValue)
  }

  const workingDirectory = process.env.GITHUB_WORKSPACE;
  const appLocation = process.env.APP_LOCATION || '';
  const appBuildCommand = process.env.APP_BUILD_COMMAND || '';
  const outputLocation = process.env.OUTPUT_LOCATION || '';
  const apiLocation = process.env.API_LOCATION || '';
  const apiBuildCommand = process.env.API_BUILD_COMMAND || '';
  const routesLocation = process.env.ROUTES_LOCATION || '';
  const buildTimeoutInMinutes = process.env.BUILD_TIMEOUT_IN_MINUTES || '';
  const configFileLocation = process.env.CONFIG_FILE_LOCATION || '';
  const deploymentEnvironment = process.env.DEPLOYMENT_ENVIRONMENT || '';
  const productionBranch = process.env.PRODUCTION_BRANCH || '';
  const dataApiLocation = process.env.DATA_API_LOCATION || '';

  const skipAppBuild = process.env.SKIP_APP_BUILD || 'false';
  const skipApiBuild = process.env.SKIP_API_BUILD || 'false';
  const isStaticExport = process.env.IS_STATIC_EXPORT || 'false';
  const apiToken = process.env.DEPLOYMENT_TOKEN || '';

  const systemVerbose = process.env.SYSTEM_DEBUG === 'true';
  const inputVerbose = process.env.VERBOSE === 'true';

  const verbose = inputVerbose === true ? true : inputVerbose === false ? false : systemVerbose === true;

  const deploymentClient = "mcr.microsoft.com/appsvc/staticappsclient:stable";
  const containerWorkingDir = "/working_dir";

  addInputStringToString("APP_LOCATION", appLocation, appLocationInputName);
  addInputStringToString("APP_BUILD_COMMAND", appBuildCommand, appBuildCommandInputName);
  addInputStringToString("OUTPUT_LOCATION", outputLocation, outputLocationInputName);
  addInputStringToString("API_LOCATION", apiLocation, apiLocationInputName);
  addInputStringToString("API_BUILD_COMMAND", apiBuildCommand, apiBuildCommandInputName);
  addInputStringToString("ROUTES_LOCATION", routesLocation, routesLocationInputName);
  addInputStringToString("BUILD_TIMEOUT_IN_MINUTES", buildTimeoutInMinutes, buildTimeoutInMinutesInputName);
  addInputStringToString("CONFIG_FILE_LOCATION", configFileLocation, configFileLocationInputName);
  addInputStringToString("DEPLOYMENT_ENVIRONMENT", deploymentEnvironment, deploymentEnvironmentInputName);
  addInputStringToString("PRODUCTION_BRANCH", productionBranch, productionBranchInputName);
  addInputStringToString("DATA_API_LOCATION", dataApiLocation, dataApiLocationInputName);

  addInputStringToString("DEPLOYMENT_TOKEN", apiToken, apiTokenInputName);

  process.env['SWA_DEPLOYMENT_CLIENT'] = deploymentClient;
  process.env['SWA_WORKING_DIR'] = workingDirectory;
  process.env['SWA_WORKSPACE_DIR'] = containerWorkingDir;

  addSystemVariableToString("SKIP_APP_BUILD", skipAppBuild.toString());
  addSystemVariableToString("SKIP_API_BUILD", skipApiBuild.toString());
  addSystemVariableToString("IS_STATIC_EXPORT", isStaticExport.toString());
  addSystemVariableToString("VERBOSE", verbose.toString());
  addSystemVariableToString("GITHUB_WORKSPACE", "");
  addSystemVariableToString("DEPLOYMENT_PROVIDER", "DevOps");
  addSystemVariableToString("REPOSITORY_URL", process.env.BUILD_REPOSITORY_URI || "");
  addSystemVariableToString("IS_PULL_REQUEST", "");
  addSystemVariableToString("BASE_BRANCH", "");
  addSystemVariableToString("REPOSITORY_BASE", containerWorkingDir);
  addSystemVariableToString("BRANCH", process.env.BUILD_SOURCEBRANCHNAME || process.env.BUILD_SOURCEBRANCH || "");
  addSystemVariableToString("DEPLOYMENT_ACTION", "upload");

  const denylistString = await fs.promises.readFile(path.join(__dirname, 'envVarDenylist.json'), 'utf8');
  const denylist = JSON.parse(denylistString);

  Object.keys(process.env).forEach((envVarKey) => {
    const envVarValue = process.env[envVarKey];

    if (envVarValue.includes("\n")) {
        console.warn("Environment variable " + envVarKey + " is a multiline string and cannot be added to the build environment.");
        return;
    }

    if (systemVariableNames.has(envVarKey)) {
        console.warn("custom variable overlapping with reserved SWA variable: " + envVarKey);
        return;
    }

    if (!denylist.includes(envVarKey.toUpperCase())) {
        addVariableToString(envVarKey, envVarValue);
    }
  });

  await fs.promises.writeFile(envVarFilePath, variableString);
}

async function runCachedDocker(envVarFilePath){


    // Run the Docker image
    // await exec.exec(`docker run ${imageName}:${imageTag}`);

    // Run the Docker image with a env-file env.list --pull=always
    await exec.exec(`docker run`, [
      "--env-file", envVarFilePath,
      "--pull=always", 
      "-v", `${process.env.SWA_WORKING_DIR}:${process.env.SWA_WORKSPACE_DIR}`,
      `${process.env.SWA_DEPLOYMENT_CLIENT}`,
      "./bin/staticsites/StaticSitesClient run"
    ]);
}

async function loadDockerContainerFromCacheOrPullAndCache(imageName, imageTag){

    // Define the Docker image cache key
    const cacheKey = `docker-${imageName}-${imageTag}`;

    // Check if the Docker image is already cached
    const path = `/tmp/${imageName}.tar`;
    const cachedPath = await cache.restoreCache([path], cacheKey);

    if (cachedPath && cachedPath.length) {
      core.info(`Using Docker image cache: ${cachedPath}`);
      await exec.exec(`docker load -i ${path}`);
    }
    else{
        // Pull the Docker image
        await exec.exec(`docker pull ${imageName}:${imageTag}`);
        
        // Save the Docker image to a path
        await exec.exec(`docker save -o ${path} ${imageName}:${imageTag}`);

        // Cache the Docker image path
        await cache.saveCache([path], cacheKey);
    }
}

run();
