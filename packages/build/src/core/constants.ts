import { relative, normalize, join } from 'path'

import { getCacheDir } from '@netlify/cache-utils'
import mapObj from 'map-obj'
import { pathExists } from 'path-exists'

import { ROOT_PACKAGE_JSON } from '../utils/json.js'

export interface NetlifyPluginConstants {
  /**
   * path to the Netlify configuration file.
   * `undefined` if none was used.
   */
  CONFIG_PATH?: string
  /**
   * directory that contains the deploy-ready HTML files and assets generated by the build. Its value is always defined, but the target might not have been created yet.
   */
  PUBLISH_DIR: string
  /**
   * the directory where function source code lives.
   * `undefined` if no `netlify/functions` directory exists in the base directory and if not specified by the user.
   */
  FUNCTIONS_SRC?: string

  /**
   * the directory inside a mono repository where it collects the settings from.
   * This is the value of the package directory field of the build settings
   * `undefined` if none is set.
   */
  PACKAGE_PATH?: string
  /**
   * the directory where internal Edge Functions source code lives. This is where build plugins should place auto-generated functions.
   * `undefined` if the version of @netlify/build does not support internal Edge Functions
   */
  INTERNAL_EDGE_FUNCTIONS_SRC?: string
  /**
   * the directory where internal function source code lives. This is where build plugins should place auto-generated functions.
   * `undefined` if the version of @netlify/build does not support internal functions
   */
  INTERNAL_FUNCTIONS_SRC?: string
  /**
   * the directory where built serverless functions are placed before deployment. Its value is always defined, but the target might not have been created yet.
   */
  FUNCTIONS_DIST: string
  /**
   * the directory where built Edge Functions are placed before deployment. Its value is always defined, but the target might not have been created yet.
   */
  EDGE_FUNCTIONS_DIST: string
  /**
   * the directory where Edge Functions source code lives.
   * `undefined` if no `netlify/edge-functions` directory exists.
   */
  EDGE_FUNCTIONS_SRC?: string
  /**
   * boolean indicating whether the build was [run locally](https://docs.netlify.com/cli/get-started/#run-builds-locally) or on Netlify
   */
  IS_LOCAL: boolean
  /**
   * version of Netlify Build as a `major.minor.patch` string
   */
  NETLIFY_BUILD_VERSION: string
  /**
   * the Netlify site ID
   */
  SITE_ID: string
  /**
   * the Netlify API access token
   */
  NETLIFY_API_TOKEN?: string
  /**
   * the Netlify API host
   */
  NETLIFY_API_HOST?: string

  /**
   * The directory that is used for caching
   * @default '.netlify/cache'
   */
  CACHE_DIR: string
}

/**
 * Retrieve constants passed to plugins
 */
export const getConstants = async function ({
  configPath,
  buildDir,
  packagePath,
  functionsDistDir,
  edgeFunctionsDistDir,
  cacheDir,
  netlifyConfig,
  siteInfo: { id: siteId },
  apiHost,
  token,
  mode,
}): Promise<NetlifyPluginConstants> {
  const isLocal = mode !== 'buildbot'
  const normalizedCacheDir = getCacheDir({ cacheDir, cwd: join(buildDir, packagePath || '') })
  const constants = {
    // Path to the Netlify configuration file
    CONFIG_PATH: configPath,
    // In monorepos this is the path that is used to point to a package that should be deployed
    PACKAGE_PATH: packagePath,
    // The directory where built serverless functions are placed before deployment
    // only on local development join with the packagePath as this directory
    // on buildbot this `functionsDistDir` is an absolute path to `/tmp/zisi-.....` so we cannot join it with the pacakgePath
    FUNCTIONS_DIST: !isLocal ? functionsDistDir : join(packagePath || '', functionsDistDir),
    // The directory where built Edge Functions are placed before deployment
    // only on local development join with the packagePath as this directory
    // on buildbot this `functionsDistDir` is an absolute path to `/tmp/zisi-.....` so we cannot join it with the pacakgePath
    EDGE_FUNCTIONS_DIST: !isLocal ? edgeFunctionsDistDir : join(packagePath || '', edgeFunctionsDistDir),
    // Path to the Netlify build cache folder
    CACHE_DIR: normalizedCacheDir,
    // Boolean indicating whether the build was run locally (Netlify CLI) or in the production CI
    IS_LOCAL: isLocal,
    // The version of Netlify Build
    NETLIFY_BUILD_VERSION: ROOT_PACKAGE_JSON.version,
    // The Netlify Site ID
    SITE_ID: siteId,
    // The Netlify API access token
    NETLIFY_API_TOKEN: token,
    // The Netlify API host
    NETLIFY_API_HOST: apiHost,
    // The directory where internal functions (i.e. generated programmatically
    // via plugins or others) live
    INTERNAL_FUNCTIONS_SRC: join(buildDir, packagePath || '', INTERNAL_FUNCTIONS_SRC),
    // The directory where internal Edge Functions (i.e. generated programmatically
    // via plugins or others) live
    INTERNAL_EDGE_FUNCTIONS_SRC: join(buildDir, packagePath || '', INTERNAL_EDGE_FUNCTIONS_SRC),
  } as const
  return (await addMutableConstants({ constants, buildDir, netlifyConfig })) as unknown as NetlifyPluginConstants
}

const INTERNAL_EDGE_FUNCTIONS_SRC = '.netlify/edge-functions'
const INTERNAL_FUNCTIONS_SRC = '.netlify/functions-internal'

// Retrieve constants which might change during the build if a plugin modifies
// `netlifyConfig` or creates some default directories.
// Unlike readonly constants, this is called again before each build step.
export const addMutableConstants = async function ({
  constants,
  buildDir,
  netlifyConfig: {
    build: { publish, edge_functions: edgeFunctions },
    functionsDirectory,
  },
}) {
  const constantsA = {
    ...constants,
    // Directory that contains the deploy-ready HTML files and assets generated by the build
    PUBLISH_DIR: publish,
    // The directory where function source code lives
    FUNCTIONS_SRC: functionsDirectory,
    // The directory where Edge Functions source code lives
    EDGE_FUNCTIONS_SRC: edgeFunctions,
  }
  const constantsB = await addDefaultConstants(constantsA, buildDir)
  const constantsC = normalizeConstantsPaths(constantsB, buildDir)
  return constantsC
}

// Some `constants` have a default value when a specific file exists.
// Those default values are assigned by `@netlify/config`. However, the build
// command or plugins might create those specific files, in which case, the
// related `constant` should be updated, unless the user has explicitly
// configured it.
const addDefaultConstants = async function (constants, buildDir) {
  const newConstants = await Promise.all(
    DEFAULT_PATHS.map(({ constantName, defaultPath }) =>
      addDefaultConstant({ constants, constantName, defaultPath, buildDir }),
    ),
  )
  return Object.assign({}, constants, ...newConstants)
}

// The current directory is the build directory, which is correct, so we don't
// need to resolve paths
const DEFAULT_PATHS = [
  // @todo Remove once we drop support for the legacy default functions directory.
  { constantName: 'FUNCTIONS_SRC', defaultPath: 'netlify-automatic-functions' },
  { constantName: 'FUNCTIONS_SRC', defaultPath: 'netlify/functions' },
  { constantName: 'EDGE_FUNCTIONS_SRC', defaultPath: 'netlify/edge-functions' },
]

const addDefaultConstant = async function ({ constants, constantName, defaultPath, buildDir }) {
  // Configuration paths are relative to the build directory.
  if (!isEmptyValue(constants[constantName]) || !(await pathExists(`${buildDir}/${defaultPath}`))) {
    return {}
  }

  // However, the plugin child process' current directory is the build directory,
  // so we can pass the relative path instead of the resolved absolute path.
  return { [constantName]: defaultPath }
}

const normalizeConstantsPaths = function (constants: Partial<NetlifyPluginConstants>, buildDir: string) {
  return mapObj(constants, (key, path: string) => [key, normalizePath(path, buildDir, key)])
}

// The current directory is `buildDir`. Most constants are inside this `buildDir`.
// Instead of passing absolute paths, we pass paths relative to `buildDir`, so
// that logs are less verbose.
const normalizePath = function (path: string | undefined, buildDir: string, key: string) {
  if (path === undefined || path === '' || !CONSTANT_PATHS.has(key)) {
    return path
  }

  const pathA = normalize(path)

  if (pathA === buildDir) {
    return '.'
  }

  if (pathA.startsWith(buildDir)) {
    return relative(buildDir, pathA)
  }

  return pathA
}

const isEmptyValue = function (path?: string) {
  return path === undefined || path === ''
}

const CONSTANT_PATHS = new Set([
  'CONFIG_PATH',
  'PUBLISH_DIR',
  'FUNCTIONS_SRC',
  'FUNCTIONS_DIST',
  'INTERNAL_EDGE_FUNCTIONS_SRC',
  'INTERNAL_FUNCTIONS_SRC',
  'EDGE_FUNCTIONS_DIST',
  'EDGE_FUNCTIONS_SRC',
  'CACHE_DIR',
])
