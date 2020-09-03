const os = require('os')
const path = require('path')
const exec = require('@actions/exec')
const io = require('@actions/io')
const tc = require('@actions/tool-cache')
const common = require('./common')
const rubyBuilderVersions = require('./ruby-builder-versions')

const builderReleaseTag = 'enable-shared'
const releasesURL = 'https://github.com/ruby/ruby-builder/releases'

const windows = common.windows

export function getAvailableVersions(platform, engine) {
  return rubyBuilderVersions.getVersions(platform)[engine]
}

export async function install(platform, engine, version) {
  return await downloadAndExtract(platform, engine, version)
}

async function downloadAndExtract(platform, engine, version) {
  const rubiesDir = windows ? `${common.drive}:` : path.join(os.homedir(), '.rubies')

  const rubyPrefix = path.join(rubiesDir, `${engine}-${version}`)

  // Set the PATH now, so the MSYS2 'tar' is in Path on Windows
  if (engine === 'rubinius') {
    common.setupPath([path.join(rubyPrefix, 'bin'), path.join(rubyPrefix, 'gems', 'bin')])
  } else {
    common.setupPath([path.join(rubyPrefix, 'bin')])
  }

  await io.mkdirP(rubiesDir)

  const downloadPath = await common.measure('Downloading Ruby', async () => {
    const url = getDownloadURL(platform, engine, version)
    console.log(url)
    return await tc.downloadTool(url)
  })

  await common.measure('Extracting Ruby', async () => {
    if (windows) {
      // Windows 2016 doesn't have system tar, use MSYS2's, it needs unix style paths
      await exec.exec('tar', [ '-xz', '-C', common.win2nix(rubiesDir), '-f', common.win2nix(downloadPath) ])
    } else {
      await exec.exec('tar', [ '-xz', '-C', rubiesDir, '-f',  downloadPath ])
    }
  })

  return rubyPrefix
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
