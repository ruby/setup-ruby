const os = require('os')
const path = require('path')
const fs = require('fs')
const util = require('util')
const stream = require('stream')
const crypto = require('crypto')
const core = require('@actions/core')
const tc = require('@actions/tool-cache')
const { performance } = require('perf_hooks')
const linuxOSInfo = require('linux-os-info')
import macosRelease from 'macos-release'

export const windows = (os.platform() === 'win32')
// Extract to SSD on Windows, see https://github.com/ruby/setup-ruby/pull/14
export const drive = (windows ? (process.env['GITHUB_WORKSPACE'] || 'C')[0] : undefined)

export const inputs = {
  selfHosted: undefined
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
  return ['head', 'debug',  'mingw', 'mswin', 'ucrt'].includes(rubyVersion)
}

export function isStableVersion(engine, rubyVersion) {
  if (engine.startsWith('truffleruby')) {
    return /^\d+(\.\d+)*(-preview\d+)?$/.test(rubyVersion)
  } else {
    return /^\d+(\.\d+)*$/.test(rubyVersion)
  }
}

export function hasBundlerDefaultGem(engine, rubyVersion) {
  return isBundler1Default(engine, rubyVersion) || isBundler2Default(engine, rubyVersion)
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

export function isBundler2Default(engine, rubyVersion) {
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

export function isBundler2dot2Default(engine, rubyVersion) {
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
    }
  } else if (engine.startsWith('truffleruby')) {
    if (version < 21.0) {
      return 2.6
    } else if (version < 22.0) {
      return 2.7
    } else if (version < 23.0) {
      return 3.0
    }
  }

  return 9.9 // unknown, assume recent
}

export function floatVersion(rubyVersion) {
  const match = rubyVersion.match(/^\d+\.\d+/)
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

const GitHubHostedPlatforms = [
  'ubuntu-20.04-x64',
  'ubuntu-22.04-x64',
  'macos-11-x64',
  'macos-12-x64',
  'macos-13-x64',
  'macos-14-x64',
  'windows-2019-x64',
  'windows-2022-x64',
]

// Actually a self-hosted runner for which  the OS and OS version does not correspond to a GitHub-hosted runner image,
export function isSelfHostedRunner() {
  if (inputs.selfHosted === undefined) {
    throw new Error('inputs.selfHosted should have been already set')
  }

  return inputs.selfHosted === 'true' ||
    !GitHubHostedPlatforms.includes(getOSNameVersionArch())
}

export function selfHostedRunnerReason() {
  if (inputs.selfHosted === 'true') {
    return 'the self-hosted input was set'
  } else if (!GitHubHostedPlatforms.includes(getOSNameVersionArch())) {
    return 'the platform does not match a GitHub-hosted runner image (or that image is deprecated and no longer supported)'
  } else {
    return 'unknown reason'
  }
}

let virtualEnvironmentName = undefined

export function getVirtualEnvironmentName() {
  if (virtualEnvironmentName !== undefined) {
    return virtualEnvironmentName
  }

  const platform = os.platform()
  let osName
  let osVersion
  if (platform === 'linux') {
    const info = linuxOSInfo({mode: 'sync'})
    osName = info.id
    osVersion = info.version_id
  } else if (platform === 'darwin') {
    osName = 'macos'
    osVersion = macosRelease().version
  } else if (platform === 'win32') {
    osName = 'windows'
    osVersion = findWindowsVersion()
  } else {
    throw new Error(`Unknown platform ${platform}`)
  }

  virtualEnvironmentName = `${osName}-${osVersion}`
  return virtualEnvironmentName
}

export function getOSNameVersionArch() {
  return `${getVirtualEnvironmentName()}-${os.arch()}`
}

function findWindowsVersion() {
  const version = os.version();
  const match = version.match(/^Windows Server (\d+) Datacenter/)
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
    // so use that path is not isSelfHostedRunner()
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
  const platform = getVirtualEnvironmentName()
  if (platform.startsWith('ubuntu-')) {
    return '/opt/hostedtoolcache'
  } else if (platform.startsWith('macos-')) {
    return '/Users/runner/hostedtoolcache'
  } else if (platform.startsWith('windows-')) {
    return 'C:\\hostedtoolcache\\windows'
  } else {
    throw new Error('Unknown platform')
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

export function getToolCacheRubyPrefix(platform, engine, version) {
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

// JRuby is installed after setupPath is called, so folder doesn't exist
function rubyIsUCRT(path) {
  return !!(fs.existsSync(path) &&
    fs.readdirSync(path, { withFileTypes: true }).find(dirent =>
      dirent.isFile() && dirent.name.match(/^x64-(ucrt|vcruntime\d{3})-ruby\d{3}\.dll$/)))
}

export function setupPath(newPathEntries) {
  let msys2Type = null
  const envPath = windows ? 'Path' : 'PATH'
  const originalPath = process.env[envPath].split(path.delimiter)
  let cleanPath = originalPath.filter(entry => !/\bruby\b/i.test(entry))

  core.startGroup(`Modifying ${envPath}`)

  // First remove the conflicting path entries
  if (cleanPath.length !== originalPath.length) {
    console.log(`Entries removed from ${envPath} to avoid conflicts with default Ruby:`)
    for (const entry of originalPath) {
      if (!cleanPath.includes(entry)) {
        console.log(`  ${entry}`)
      }
    }
    core.exportVariable(envPath, cleanPath.join(path.delimiter))
  }

  // Then add new path entries using core.addPath()
  let newPath
  if (windows) {
    // main Ruby dll determines whether mingw or ucrt build
    msys2Type = rubyIsUCRT(newPathEntries[0]) ? 'ucrt64' : 'mingw64'

    // add MSYS2 in path for all Rubies on Windows, as it provides a better bash shell and a native toolchain
    const msys2 = [`C:\\msys64\\${msys2Type}\\bin`, 'C:\\msys64\\usr\\bin']
    newPath = [...newPathEntries, ...msys2]
  } else {
    newPath = newPathEntries
  }
  console.log(`Entries added to ${envPath} to use selected Ruby:`)
  for (const entry of newPath) {
    console.log(`  ${entry}`)
  }
  core.endGroup()

  core.addPath(newPath.join(path.delimiter))
  return msys2Type
}
