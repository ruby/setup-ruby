const os = require('os')
const fs = require('fs')
const core = require('@actions/core')
const io = require('@actions/io')
const tc = require('@actions/tool-cache')
const axios = require('axios')

const releasesURL = 'https://github.com/eregon/ruby-install-builder/releases'
const metadataURL = 'https://raw.githubusercontent.com/eregon/ruby-install-builder/metadata'

async function run() {
  try {
    const ruby = await getRubyEngineAndVersion(core.getInput('ruby-version'))

    const rubiesDir = `${process.env.HOME}/.rubies`
    await io.mkdirP(rubiesDir)

    const platform = getVirtualEnvironmentName()
    const tag = await getLatestReleaseTag()
    const url = `${releasesURL}/download/${tag}/${ruby}-${platform}.tar.gz`
    console.log(url)

    const downloadPath = await tc.downloadTool(url)
    await tc.extractTar(downloadPath, rubiesDir)

    const rubyPrefix = `${rubiesDir}/${ruby}`
    core.addPath(`${rubyPrefix}/bin`)
    core.setOutput('ruby-prefix', rubyPrefix)
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function getLatestReleaseTag() {
  const response = await axios.get(`${metadataURL}/latest_release.tag`)
  return response.data.trim()
}

async function getRubyEngineAndVersion(rubyVersion) {
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
        File an issue at https://github.com/eregon/ruby-install-builder/issues if would like support for a new version`)
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
