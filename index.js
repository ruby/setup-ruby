const os = require('os')
const fs = require('fs')
const core = require('@actions/core')

async function run() {
  try {
    const platform = getVirtualEnvironmentName()
    const [engine, version] = parseRubyEngineAndVersion(core.getInput('ruby-version'))

    let installer
    if (platform === 'windows-latest' && engine !== 'jruby') {
      installer = require('./windows')
    } else {
      installer = require('./ruby-install-builder')
    }

    const engineVersions = installer.getAvailableVersions(platform, engine)
    const ruby = validateRubyEngineAndVersion(platform, engineVersions, engine, version)

    const rubyPrefix = await installer.install(platform, ruby)
    core.setOutput('ruby-prefix', rubyPrefix)
  } catch (error) {
    core.setFailed(error.message)
  }
}

function parseRubyEngineAndVersion(rubyVersion) {
  if (rubyVersion === '.ruby-version') { // Read from .ruby-version
    rubyVersion = fs.readFileSync('.ruby-version', 'utf8').trim()
    console.log(`Using ${rubyVersion} as input from file .ruby-version`)
  }

  let engine, version
  if (rubyVersion.match(/^\d+/)) { // X.Y.Z => ruby-X.Y.Z
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
        File an issue at https://github.com/eregon/use-ruby-action/issues if would like support for a new version`)
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

run()
