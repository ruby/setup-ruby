const os = require('os')
const path = require('path')
const fs = require('fs')
const util = require('util')
const stream = require('stream')
const crypto = require('crypto')
const core = require('@actions/core')
const tc = require('@actions/tool-cache')
const exec = require('@actions/exec')
const { performance } = require('perf_hooks')
const linuxOSInfo = require('linux-os-info')

export const windows = (os.platform() === 'win32')
// Extract to SSD on Windows, see https://github.com/ruby/setup-ruby/pull/14
export const drive = (windows ? (process.env['RUNNER_TEMP'] || 'C')[0] : undefined)
const PATH_ENV_VAR = windows ? 'Path' : 'PATH'

export const inputs = {
  selfHosted: undefined,
  token: undefined
}

export function partition(string, separator) {
  const i = string.indexOf(separator)
  if (i === -1) {
    throw new Error(`No separator ${separator} in string ${string}`)
  }
  return [string.slice(0, i), string.slice(i + separator.length, string.length)]
}

let inGroup = false

export async function measure(name, block) {
  const body = async () => {
    const start = performance.now()
    try {
      return await block()
    } finally {
      const end = performance.now()
      const duration = (end - start) / 1000.0
      console.log(`Took ${duration.toFixed(2).padStart(6)} seconds`)
    }
  }

  if (inGroup) {
    // Nested groups are not yet supported on GitHub Actions
    console.log(`> ${name}`)
    return await body()
  } else {
    inGroup = true
    try {
      return await core.group(name, body)
    } finally {
      inGroup = false
    }
  }
}

// Same as mesaure() but without the group, and no time shown on error
export async function time(name, block) {
  console.log(`> ${name}`)
  const start = performance.now()
  const value = await block()
  const end = performance.now()

  const duration = (end - start) / 1000.0
  console.log(`Took ${duration.toFixed(2).padStart(6)} seconds`)
  return value
}

export function isHeadVersion(rubyVersion) {
  // asan-release counts as "head" because the version cannot be selected -- you can only get whatever's latest
  return ['head', 'debug',  'mingw', 'mswin', 'ucrt', 'asan', 'asan-release'].includes(rubyVersion)
}

export function isStableVersion(engine, rubyVersion) {
  if (engine.startsWith('truffleruby')) {
    return /^\d+(\.\d+)*(-preview\d+)?$/.test(rubyVersion)
  } else {
    return /^\d+(\.\d+)*$/.test(rubyVersion)
  }
}

export function hasBundlerDefaultGem(engine, rubyVersion) {
  return isBundler1Default(engine, rubyVersion) || isBundler2PlusDefault(engine, rubyVersion)
}

export function isBundler1Default(engine, rubyVersion) {
  if (engine === 'ruby') {
    return floatVersion(rubyVersion) >= 2.6 && floatVersion(rubyVersion) < 2.7
  } else if (engine.startsWith('truffleruby')) {
    return floatVersion(rubyVersion) < 21.0
  } else if (engine === 'jruby') {
    return false
  } else {
    return false
  }
}

export function isBundler2PlusDefault(engine, rubyVersion) {
  if (engine === 'ruby') {
    return floatVersion(rubyVersion) >= 2.7
  } else if (engine.startsWith('truffleruby')) {
    return floatVersion(rubyVersion) >= 21.0
  } else if (engine === 'jruby') {
    return floatVersion(rubyVersion) >= 9.3
  } else {
    return false
  }
}

export function isBundler2dot2PlusDefault(engine, rubyVersion) {
  if (engine === 'ruby') {
    return floatVersion(rubyVersion) >= 3.0
  } else if (engine.startsWith('truffleruby')) {
    return floatVersion(rubyVersion) >= 22.0
  } else if (engine === 'jruby') {
    return floatVersion(rubyVersion) >= 9.3
  } else {
    return false
  }
}

const UNKNOWN_TARGET_RUBY_VERSION = 9.9

export function isBundler4PlusDefault(engine, rubyVersion) {
  const version = targetRubyVersion(engine, rubyVersion)
  return version != UNKNOWN_TARGET_RUBY_VERSION && version >= 4.0
}

export function targetRubyVersion(engine, rubyVersion) {
  const version = floatVersion(rubyVersion)
  if (engine === 'ruby') {
    return version
  } else if (engine === 'jruby') {
    if (version === 9.1) {
      return 2.3
    } else if (version === 9.2) {
      return 2.5
    } else if (version === 9.3) {
      return 2.6
    } else if (version === 9.4) {
      return 3.1
    } else if (version === 10.0) {
      return 3.4
    }
  } else if (engine.startsWith('truffleruby')) {
    if (version < 21.0) {
      return 2.6
    } else if (version < 22.0) {
      return 2.7
    } else if (version < 23.0) {
      return 3.0
    } else if (version < 23.1) {
      return 3.1
    } else if (version < 24.2) {
      return 3.2
    }
  }

  return UNKNOWN_TARGET_RUBY_VERSION // unknown, assume recent
}

export function floatVersion(rubyVersion) {
  const match = rubyVersion.match(/^\d+(\.\d+|$)/)
  if (match) {
    return parseFloat(match[0])
  } else if (isHeadVersion(rubyVersion)) {
    return 999.999
  } else {
    throw new Error(`Could not convert version ${rubyVersion} to a float`)
  }
}

export async function hashFile(file) {
  // See https://github.com/actions/runner/blob/master/src/Misc/expressionFunc/hashFiles/src/hashFiles.ts
  const hash = crypto.createHash('sha256')
  const pipeline = util.promisify(stream.pipeline)
  await pipeline(fs.createReadStream(file), hash)
  return hash.digest('hex')
}

// macos is not listed explicitly, see below
const GitHubHostedPlatforms = [
  'ubuntu-22.04-x64',
  'ubuntu-22.04-arm64',
  'ubuntu-24.04-x64',
  'ubuntu-24.04-arm64',
  'windows-2022-x64',
  'windows-2025-x64',
  'windows-11-arm64'
]

// Precisely: whether we have builds for that platform and there are GitHub-hosted runners to test it
function isSupportedPlatform() {
  const platform = getOSName()
  switch (platform) {
    case 'ubuntu':
      return GitHubHostedPlatforms.includes(getOSNameVersionArch())
    case 'macos':
      // See https://github.com/ruby/ruby-builder/blob/master/README.md#naming
      // 13 on arm64 because of old macos-arm-oss runners
      return (os.arch() === 'x64' && parseInt(getOSVersion()) >= 13) ||
          (os.arch() === 'arm64' && parseInt(getOSVersion()) >= 13)
    case 'windows':
      return GitHubHostedPlatforms.includes(getOSNameVersionArch())
  }
}

// Actually a self-hosted runner for which the OS and OS version does not correspond to a GitHub-hosted runner image,
export function isSelfHostedRunner() {
  if (inputs.selfHosted === undefined) {
    throw new Error('inputs.selfHosted should have been already set')
  }

  return inputs.selfHosted === 'true' || !isSupportedPlatform()
}

export function selfHostedRunnerReason() {
  if (inputs.selfHosted === 'true') {
    return 'the self-hosted input was set'
  } else if (!isSupportedPlatform()) {
    return 'the platform does not match a GitHub-hosted runner image (or that image is deprecated and no longer supported)'
  } else {
    return 'unknown reason'
  }
}

let osName = undefined
let osVersion = undefined

export function getOSName() {
  if (osName !== undefined) {
    return osName
  }

  const platform = os.platform()
  if (platform === 'linux') {
    const info = linuxOSInfo({mode: 'sync'})
    osName = info.id
  } else if (platform === 'darwin') {
    osName = 'macos'
  } else if (platform === 'win32') {
    osName = 'windows'
  } else {
    throw new Error(`Unknown platform ${platform}`)
  }

  return osName
}

export function getOSVersion() {
  if (osVersion !== undefined) {
    return osVersion
  }

  const platform = os.platform()
  if (platform === 'linux') {
    const info = linuxOSInfo({mode: 'sync'})
    osVersion = info.version_id
  } else if (platform === 'darwin') {
    // See https://github.com/sindresorhus/macos-release/blob/main/index.js
    const darwinVersion = parseInt(os.release().match(/^\d+/)[0])
    osVersion = `${darwinVersion - 9}`
  } else if (platform === 'win32') {
    osVersion = findWindowsVersion()
  } else {
    throw new Error(`Unknown platform ${platform}`)
  }

  return osVersion
}

export function getOSNameVersion() {
  return `${getOSName()}-${getOSVersion()}`
}

export function getOSNameVersionArch() {
  return `${getOSName()}-${getOSVersion()}-${os.arch()}`
}

function findWindowsVersion() {
  const version = os.version()
  const match = version.match(/^Windows(?: Server)? (\d+) (?:Datacenter|Enterprise)/)
  if (match) {
    return match[1]
  } else {
    throw new Error('Could not find Windows version')
  }
}

export function shouldUseToolCache(engine, version) {
  return (engine === 'ruby' && !isHeadVersion(version)) || isSelfHostedRunner()
}

export function getToolCachePath() {
  if (isSelfHostedRunner()) {
    return getRunnerToolCache()
  } else {
    // Rubies prebuilt by this action embed this path rather than using $RUNNER_TOOL_CACHE
    // so use that path if not isSelfHostedRunner()
    return getDefaultToolCachePath()
  }
}

export function getRunnerToolCache() {
  const runnerToolCache = process.env['RUNNER_TOOL_CACHE']
  if (!runnerToolCache) {
    throw new Error('$RUNNER_TOOL_CACHE must be set')
  }
  return runnerToolCache
}

// Rubies prebuilt by this action embed this path rather than using $RUNNER_TOOL_CACHE
function getDefaultToolCachePath() {
  const platform = getOSName()
  switch (platform) {
    case 'ubuntu':
      return '/opt/hostedtoolcache'
    case 'macos':
      return '/Users/runner/hostedtoolcache'
    case 'windows':
      return 'C:\\hostedtoolcache\\windows'
  }
}

// tc.find() but using RUNNER_TOOL_CACHE=getToolCachePath()
export function toolCacheFind(engine, version) {
  const originalToolCache = getToolCachePath()
  process.env['RUNNER_TOOL_CACHE'] = getToolCachePath()
  try {
    return tc.find(engineToToolCacheName(engine), version)
  } finally {
    process.env['RUNNER_TOOL_CACHE'] = originalToolCache
  }
}

function engineToToolCacheName(engine) {
  return {
    ruby: 'Ruby',
    jruby: 'JRuby',
    truffleruby: 'TruffleRuby',
    "truffleruby+graalvm": 'TruffleRubyGraalVM'
  }[engine]
}

export function getToolCacheRubyPrefix(_platform, engine, version) {
  const toolCache = getToolCachePath()
  return path.join(toolCache, engineToToolCacheName(engine), version, os.arch())
}

export function toolCacheCompleteFile(toolCacheRubyPrefix) {
  return `${toolCacheRubyPrefix}.complete`
}

export function createToolCacheCompleteFile(toolCacheRubyPrefix) {
  fs.writeFileSync(toolCacheCompleteFile(toolCacheRubyPrefix), '')
}

// convert windows path like C:\Users\runneradmin to /c/Users/runneradmin
export function win2nix(path) {
  if (/^[A-Z]:/i.test(path)) {
    // path starts with drive
    path = `/${path[0].toLowerCase()}${partition(path, ':')[1]}`
  }
  return path.replace(/\\/g, '/').replace(/ /g, '\\ ')
}

export function setupPath(newPathEntries) {
  const originalPath = process.env[PATH_ENV_VAR].split(path.delimiter)
  let cleanPath = originalPath.filter(entry => !/\bruby\b/i.test(entry))

  core.group(`Modifying ${PATH_ENV_VAR}`, async () => {
    // First remove the conflicting path entries
    if (cleanPath.length !== originalPath.length) {
      console.log(`Entries removed from ${PATH_ENV_VAR} to avoid conflicts with default Ruby:`)
      for (const entry of originalPath) {
        if (!cleanPath.includes(entry)) {
          console.log(`  ${entry}`)
        }
      }
      core.exportVariable(PATH_ENV_VAR, cleanPath.join(path.delimiter))
    }

    console.log(`Entries added to ${PATH_ENV_VAR} to use selected Ruby:`)
    for (const entry of newPathEntries) {
      console.log(`  ${entry}`)
    }
  })

  core.addPath(newPathEntries.join(path.delimiter))
}

export async function setupJavaHome(rubyPrefix) {
  await measure("Modifying JAVA_HOME for JRuby", async () => {
    console.log("attempting to run with existing JAVA_HOME")

    const javaHome = process.env['JAVA_HOME']
    let java = javaHome ? path.join(javaHome, 'bin/java') : 'java'
    let ret = await exec.exec(java, ['-jar', path.join(rubyPrefix, 'lib/jruby.jar'), '--version'], {ignoreReturnCode: true})

    if (ret === 0) {
      console.log("JRuby successfully starts, using existing JAVA_HOME")
    } else {
      console.log("JRuby failed to start, try Java 21 envs")

      let arch = os.arch()
      if (arch === "arm64" && os.platform() === "win32") {
        arch = "AARCH64"
      } else if (arch === "x64" || os.platform() !== "darwin") {
        arch = "X64"
      }

      // JAVA_HOME_21_AARCH64 - https://github.com/actions/partner-runner-images/blob/main/images/arm-windows-11-image.md#java
      // JAVA_HOME_21_arm64 - https://github.com/actions/runner-images/blob/main/images/macos/macos-15-arm64-Readme.md#java
      // JAVA_HOME_21_X64 - https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md#java
      let newHomeVar = `JAVA_HOME_21_${arch}`
      let newHome = process.env[newHomeVar]
      let bin = path.join(newHome, 'bin')

      if (newHome === "undefined") {
        throw new Error(`JAVA_HOME is not Java 21+ needed for JRuby and \$${newHomeVar} is not defined`)
      }

      console.log(`Setting JAVA_HOME to ${newHomeVar} path ${newHome}`)
      core.exportVariable("JAVA_HOME", newHome)

      console.log(`Adding ${bin} to ${PATH_ENV_VAR}`)
      core.addPath(bin)
    }
  })
}

// Determines if two keys are an exact match for the purposes of cache matching
// Specifically, this is a case-insensitive match that ignores accents
// From actions/cache@v3 src/utils/actionUtils.ts (MIT)
export function isExactCacheKeyMatch(key, cacheKey) {
  return !!(
      cacheKey &&
      cacheKey.localeCompare(key, undefined, {
          sensitivity: 'accent'
      }) === 0
  );
}

export async function download(url) {
  const auth = inputs.token ? `token ${inputs.token}` : undefined
  return await tc.downloadTool(url, undefined, auth)
}
