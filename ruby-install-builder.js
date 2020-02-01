const os = require('os')
const path = require('path')
const core = require('@actions/core')
const io = require('@actions/io')
const tc = require('@actions/tool-cache')
const rubyBuilderVersions = require('./ruby-install-builder-versions')
const axios = require('axios')

const builderReleaseTag = 'builds-newer-openssl'
const releasesURL = 'https://github.com/eregon/ruby-install-builder/releases'

const truffleRubyHeadReleaseURL = 'https://github.com/eregon/truffleruby-dev-builder/releases/download'
const truffleRubyHeadMetadataURL = 'https://raw.githubusercontent.com/eregon/truffleruby-dev-builder/metadata/latest_build.tag'

export function getAvailableVersions(platform, engine) {
  return rubyBuilderVersions.getVersions(platform)[engine]
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

  const url = await getDownloadURL(platform, ruby)
  console.log(url)

  const downloadPath = await tc.downloadTool(url)
  await tc.extractTar(downloadPath, rubiesDir)

  return path.join(rubiesDir, ruby)
}

async function getDownloadURL(platform, ruby) {
  if (ruby === 'truffleruby-head') {
    const response = await axios.get(truffleRubyHeadMetadataURL)
    const tag = response.data.trim()
    return `${truffleRubyHeadReleaseURL}/${tag}/${ruby}-${platform}.tar.gz`
  } else {
    return `${releasesURL}/download/${builderReleaseTag}/${ruby}-${platform}.tar.gz`
  }
}
