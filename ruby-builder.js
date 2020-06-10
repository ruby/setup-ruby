const os = require('os')
const path = require('path')
const exec = require('@actions/exec')
const io = require('@actions/io')
const tc = require('@actions/tool-cache')
const common = require('./common')
const rubyBuilderVersions = require('./ruby-builder-versions')

const builderReleaseTag = 'enable-shared'
const releasesURL = 'https://github.com/ruby/ruby-builder/releases'

export function getAvailableVersions(platform, engine) {
  return rubyBuilderVersions.getVersions(platform)[engine]
}

export async function install(platform, engine, version) {
  const rubyPrefix = await downloadAndExtract(platform, engine, version)
  let newPathEntries
  if (engine === 'rubinius') {
    newPathEntries = [path.join(rubyPrefix, 'bin'), path.join(rubyPrefix, 'gems', 'bin')]
  } else {
    newPathEntries = [path.join(rubyPrefix, 'bin')]
  }
  return [rubyPrefix, newPathEntries]
}

async function downloadAndExtract(platform, engine, version) {
  const rubiesDir = path.join(os.homedir(), '.rubies')
  await io.mkdirP(rubiesDir)

  const downloadPath = await common.measure('Downloading Ruby', async () => {
    const url = getDownloadURL(platform, engine, version)
    console.log(url)
    return await tc.downloadTool(url)
  })

  await common.measure('Extracting Ruby', async () => {
    if (process.env.ImageOS === 'win16') {
      const tar = '"C:\\Program Files\\Git\\usr\\bin\\tar.exe"'
      await exec.exec(tar, [ '-xz', '-C', common.win2nix(rubiesDir), '-f', common.win2nix(downloadPath) ])
    } else {
      const tar = platform.startsWith('windows') ? 'C:\\Windows\\system32\\tar.exe' : 'tar'
      await exec.exec(tar, [ '-xz', '-C', rubiesDir, '-f',  downloadPath ])
    }
  })

  return path.join(rubiesDir, `${engine}-${version}`)
}

function getDownloadURL(platform, engine, version) {
  if (common.isHeadVersion(version)) {
    return getLatestHeadBuildURL(platform, engine, version)
  } else {
    return `${releasesURL}/download/${builderReleaseTag}/${engine}-${version}-${platform}.tar.gz`
  }
}

function getLatestHeadBuildURL(platform, engine, version) {
  return `https://github.com/ruby/${engine}-dev-builder/releases/latest/download/${engine}-${version}-${platform}.tar.gz`
}
