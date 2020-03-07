const os = require('os')
const fs = require('fs')
const path = require('path')
const core = require('@actions/core')

async function run() {
  try {
    const platform = getVirtualEnvironmentName()
    const [engine, version] = parseRubyEngineAndVersion(core.getInput('ruby-version'))

    let installer
    if (platform === 'windows-latest' && engine !== 'jruby') {
      installer = require('./windows')
    } else {
      installer = require('./ruby-builder')
    }

    const engineVersions = installer.getAvailableVersions(platform, engine)
    const ruby = validateRubyEngineAndVersion(platform, engineVersions, engine, version)

    const [rubyPrefix, newPathEntries] = await installer.install(platform, ruby)

    setupPath(ruby, newPathEntries)
    core.setOutput('ruby-prefix', rubyPrefix)
  } catch (error) {
    core.setFailed(error.message)
  }
}

function parseRubyEngineAndVersion(rubyVersion) {
  if (rubyVersion === 'default') {
    if (fs.existsSync('.ruby-version')) {
      rubyVersion = '.ruby-version'
    } else if (fs.existsSync('.tool-versions')) {
      rubyVersion = '.tool-versions'
    } else {
      throw new Error('input ruby-version needs to be specified if no .ruby-version or .tool-versions file exists')
    }
  }

  if (rubyVersion === '.ruby-version') { // Read from .ruby-version
    rubyVersion = fs.readFileSync('.ruby-version', 'utf8').trim()
    console.log(`Using ${rubyVersion} as input from file .ruby-version`)
  } else if (rubyVersion === '.tool-versions') { // Read from .tool-versions
    const toolVersions = fs.readFileSync('.tool-versions', 'utf8').trim()
    const rubyLine = toolVersions.split(/\r?\n/).filter(e => e.match(/^ruby\s/))[0]
    rubyVersion = rubyLine.split(/\s+/, 2)[1]
    console.log(`Using ${rubyVersion} as input from file .tool-versions`)
  }

  let engine, version
  if (rubyVersion.match(/^(\d+|head|mingw|mswin)/)) { // X.Y.Z => ruby-X.Y.Z
    engine = 'ruby'
    version = rubyVersion
  } else if (!rubyVersion.includes('-')) { // myruby -> myruby-stableVersion
    engine = rubyVersion
    version = '' // Let the logic below find the version
  } else { // engine-X.Y.Z
    [engine, version] = rubyVersion.split('-', 2)
  }

  return [engine, version]
}

function validateRubyEngineAndVersion(platform, engineVersions, engine, version) {
  if (!engineVersions) {
    throw new Error(`Unknown engine ${engine} on ${platform}`)
  }

  if (!engineVersions.includes(version)) {
    const latestToFirstVersion = engineVersions.slice().reverse()
    const found = latestToFirstVersion.find(v => v !== 'head' && v.startsWith(version))
    if (found) {
      version = found
    } else {
      throw new Error(`Unknown version ${version} for ${engine} on ${platform}
        available versions for ${engine} on ${platform}: ${engineVersions.join(', ')}
        File an issue at https://github.com/ruby/setup-ruby/issues if would like support for a new version`)
    }
  }

  return engine + '-' + version
}

function getVirtualEnvironmentName() {
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

function setupPath(ruby, newPathEntries) {
  const originalPath = process.env['PATH'].split(path.delimiter)
  let cleanPath = originalPath.filter(e => !/\bruby\b/i.test(e))

  if (cleanPath.length !== originalPath.length) {
    console.log("Entries removed from PATH to avoid conflicts with Ruby:")
    for (const entry of originalPath) {
      if (!cleanPath.includes(entry)) {
        console.log(`  ${entry}`)
      }
    }
  }

  core.exportVariable('PATH', [...newPathEntries, ...cleanPath].join(path.delimiter))
}

run()
