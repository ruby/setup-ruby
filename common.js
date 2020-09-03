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

export async function measure(name, block) {
  return await core.group(name, async () => {
    const start = performance.now()
    try {
      return await block()
    } finally {
      const end = performance.now()
      const duration = (end - start) / 1000.0
      console.log(`Took ${duration.toFixed(2).padStart(6)} seconds`)
    }
  })
}

export function isHeadVersion(rubyVersion) {
  return rubyVersion === 'head' || rubyVersion === 'debug' || rubyVersion === 'mingw' || rubyVersion === 'mswin'
}

export async function hashFile(file) {
  // See https://github.com/actions/runner/blob/master/src/Misc/expressionFunc/hashFiles/src/hashFiles.ts
  const hash = crypto.createHash('sha256')
  const pipeline = util.promisify(stream.pipeline)
  await pipeline(fs.createReadStream(file), hash)
  return hash.digest('hex')
}

export function getVirtualEnvironmentName() {
  const platform = os.platform()
  if (platform === 'linux') {
    return `ubuntu-${findUbuntuVersion()}`
  } else if (platform === 'darwin') {
    return 'macos-latest'
  } else if (platform === 'win32') {
    return 'windows-latest'
  } else {
    throw new Error(`Unknown platform ${platform}`)
  }
}

function findUbuntuVersion() {
  const lsb_release = fs.readFileSync('/etc/lsb-release', 'utf8')
  const match = lsb_release.match(/^DISTRIB_RELEASE=(\d+\.\d+)$/m)
  if (match) {
    return match[1]
  } else {
    throw new Error('Could not find Ubuntu version')
  }
}

// convert windows path like C:\Users\runneradmin to /c/Users/runneradmin
export function win2nix(path) {
  if (/^[A-Z]:/i.test(path)) {
    // path starts with drive
    path = `/${path[0].toLowerCase()}${path.split(':', 2)[1]}`
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
