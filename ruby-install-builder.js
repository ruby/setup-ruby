const os = require('os')
const path = require('path')
const core = require('@actions/core')
const io = require('@actions/io')
const tc = require('@actions/tool-cache')
const axios = require('axios')

const builderReleaseTag = 'builds-newer-openssl'
const releasesURL = 'https://github.com/eregon/ruby-install-builder/releases'
const metadataURL = 'https://raw.githubusercontent.com/eregon/ruby-install-builder/metadata'

export async function getAvailableVersions(engine) {
  const response = await axios.get(`${metadataURL}/versions.json`)
  const versions = response.data
  return versions[engine]
}

export async function install(platform, ruby) {
  const rubyPrefix = await downloadAndExtract(platform, ruby)

  core.addPath(path.join(rubyPrefix, 'bin'))
  if (ruby.startsWith('rubinius')) {
    core.addPath(path.join(rubyPrefix, 'gems', 'bin'))
  }

  return rubyPrefix
}

async function downloadAndExtract(platform, ruby) {
  const rubiesDir = path.join(os.homedir(), '.rubies')
  await io.mkdirP(rubiesDir)

  const url = `${releasesURL}/download/${builderReleaseTag}/${ruby}-${platform}.tar.gz`
  console.log(url)

  const downloadPath = await tc.downloadTool(url)
  await tc.extractTar(downloadPath, rubiesDir)

  return path.join(rubiesDir, ruby)
}
