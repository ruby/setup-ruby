const os = require('os')
const path = require('path')
const fs = require('fs')
const util = require('util')
const stream = require('stream')
const crypto = require('crypto')
const core = require('@actions/core')
const { performance } = require('perf_hooks')

export const windows = (os.platform() === 'win32')
// Extract to SSD on Windows, see https://github.com/ruby/setup-ruby/pull/14
export const drive = (windows ? (process.env['GITHUB_WORKSPACE'] || 'C')[0] : undefined)

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

export function isHeadVersion(rubyVersion) {
  return rubyVersion === 'head' || rubyVersion === 'debug' || rubyVersion === 'mingw' || rubyVersion === 'mswin'
}

export function isStableVersion(rubyVersion) {
  return /^\d+(\.\d+)*$/.test(rubyVersion)
}

export function isBundler2Default(engine, rubyVersion) {
  if (engine === 'ruby') {
    return isHeadVersion(rubyVersion) || floatVersion(rubyVersion) >= 2.7
  } else if (engine === 'truffleruby') {
    return isHeadVersion(rubyVersion)
  } else {
    return false
  }
}

export function floatVersion(rubyVersion) {
  const match = rubyVersion.match(/^\d+\.\d+/)
  if (match) {
    return parseFloat(match[0])
  } else {
    return 0.0
  }
}

export async function hashFile(file) {
  // See https://github.com/actions/runner/blob/master/src/Misc/expressionFunc/hashFiles/src/hashFiles.ts
  const hash = crypto.createHash('sha256')
  const pipeline = util.promisify(stream.pipeline)
  await pipeline(fs.createReadStream(file), hash)
  return hash.digest('hex')
}

function getImageOS() {
  const imageOS = process.env['ImageOS']
  if (!imageOS) {
    throw new Error('The environment variable ImageOS must be set')
  }
  return imageOS
}

export function getVirtualEnvironmentName() {
  const imageOS = getImageOS()

  let match = imageOS.match(/^ubuntu(\d+)/) // e.g. ubuntu18
  if (match) {
    return `ubuntu-${match[1]}.04`
  }

  match = imageOS.match(/^macos(\d{2})(\d+)?/) // e.g. macos1015, macos11
  if (match) {
    return `macos-${match[1]}.${match[2] || '0'}`
  }

  match = imageOS.match(/^win(\d+)/) // e.g. win19
  if (match) {
    return `windows-20${match[1]}`
  }

  throw new Error(`Unknown ImageOS ${imageOS}`)
}

export function shouldUseToolCache(engine, version) {
  return engine === 'ruby' && !isHeadVersion(version)
}

function getPlatformToolCache(platform) {
  // Hardcode paths rather than using $RUNNER_TOOL_CACHE because the prebuilt Rubies cannot be moved anyway
  if (platform.startsWith('ubuntu-')) {
    return '/opt/hostedtoolcache'
  } else if (platform.startsWith('macos-')) {
    return '/Users/runner/hostedtoolcache'
  } else if (platform.startsWith('windows-')) {
    return 'C:/hostedtoolcache/windows'
  } else {
    throw new Error('Unknown platform')
  }
}

export function getToolCacheRubyPrefix(platform, version) {
  const toolCache = getPlatformToolCache(platform)
  return path.join(toolCache, 'Ruby', version, 'x64')
}

export function createToolCacheCompleteFile(toolCacheRubyPrefix) {
  const completeFile = `${toolCacheRubyPrefix}.complete`
  fs.writeFileSync(completeFile, '')
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
  const envPath = windows ? 'Path' : 'PATH'
  const originalPath = process.env[envPath].split(path.delimiter)
  let cleanPath = originalPath.filter(entry => !/\bruby\b/i.test(entry))

  // First remove the conflicting path entries
  if (cleanPath.length !== originalPath.length) {
    core.startGroup(`Cleaning ${envPath}`)
    console.log(`Entries removed from ${envPath} to avoid conflicts with Ruby:`)
    for (const entry of originalPath) {
      if (!cleanPath.includes(entry)) {
        console.log(`  ${entry}`)
      }
    }
    core.exportVariable(envPath, cleanPath.join(path.delimiter))
    core.endGroup()
  }

  // Then add new path entries using core.addPath()
  let newPath
  if (windows) {
    // add MSYS2 in path for all Rubies on Windows, as it provides a better bash shell and a native toolchain
    const msys2 = ['C:\\msys64\\mingw64\\bin', 'C:\\msys64\\usr\\bin']
    newPath = [...newPathEntries, ...msys2]
  } else {
    newPath = newPathEntries
  }
  core.addPath(newPath.join(path.delimiter))
}
