const os = require('os')
const fs = require('fs')
const core = require('@actions/core')
const io = require('@actions/io')
const tc = require('@actions/tool-cache')
const axios = require('axios')
const windows = require('./windows')

const builderReleaseTag = 'builds-newer-openssl'
const releasesURL = 'https://github.com/eregon/ruby-install-builder/releases'
const metadataURL = 'https://raw.githubusercontent.com/eregon/ruby-install-builder/metadata'

async function run() {
  try {
    const platform = getVirtualEnvironmentName()
    const ruby = await getRubyEngineAndVersion(core.getInput('ruby-version'))

    let rubyPrefix
    if (platform === 'windows-latest') {
      rubyPrefix = await windows.downloadExtractAndSetPATH(ruby)
    } else {
      if (ruby.startsWith('jruby')) {
        // Workaround for https://github.com/actions/virtual-environments/issues/242
        core.exportVariable('CLASSPATH', '')
      }
      rubyPrefix = await downloadAndExtract(platform, ruby)
      core.addPath(`${rubyPrefix}/bin`)
    }
    core.setOutput('ruby-prefix', rubyPrefix)
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function downloadAndExtract(platform, ruby) {
  const rubiesDir = `${process.env.HOME}/.rubies`
  await io.mkdirP(rubiesDir)

  const url = `${releasesURL}/download/${builderReleaseTag}/${ruby}-${platform}.tar.gz`
  console.log(url)

  const downloadPath = await tc.downloadTool(url)
  await tc.extractTar(downloadPath, rubiesDir)

  return `${rubiesDir}/${ruby}`
}

async function getRubyEngineAndVersion(rubyVersion) {
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

  const response = await axios.get(`${metadataURL}/versions.json`)
  const stableVersions = response.data
  const engineVersions = stableVersions[engine]
  if (!engineVersions) {
    throw new Error(`Unknown engine ${engine} (input: ${rubyVersion})`)
  }

  if (!engineVersions.includes(version)) {
    const latestToFirstVersion = engineVersions.slice().reverse()
    const found = latestToFirstVersion.find(v => v.startsWith(version))
    if (found) {
      version = found
    } else {
      throw new Error(`Unknown version ${version} for ${engine}
        input: ${rubyVersion}
        available versions for ${engine}: ${engineVersions.join(', ')}
        File an issue at https://github.com/eregon/use-ruby-action/issues if would like support for a new version`)
    }
  }

  return engine + '-' + version
}

function getVirtualEnvironmentName() {
  const platform = os.platform()
  if (platform == 'linux') {
    return `ubuntu-${findUbuntuVersion()}`
  } else if (platform == 'darwin') {
    return 'macos-latest'
  } else if (platform == 'win32') {
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
