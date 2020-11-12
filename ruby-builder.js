const os = require('os')
const path = require('path')
const core = require('@actions/core')
const exec = require('@actions/exec')
const io = require('@actions/io')
const tc = require('@actions/tool-cache')
const common = require('./common')
const rubyBuilderVersions = require('./ruby-builder-versions')

const builderReleaseTag = 'toolcache'
const releasesURL = 'https://github.com/ruby/ruby-builder/releases'

const windows = common.windows

export function getAvailableVersions(platform, engine) {
  return rubyBuilderVersions.getVersions(platform)[engine]
}

export async function install(platform, engine, version) {
  return await downloadAndExtract(platform, engine, version)
}

async function downloadAndExtract(platform, engine, version) {
  let rubyPrefix
  if (common.shouldExtractInToolCache(engine, version)) {
    rubyPrefix = common.getToolCacheRubyPrefix(platform, version)
  } else if (windows) {
    rubyPrefix = path.join(`${common.drive}:`, `${engine}-${version}`)
  } else {
    rubyPrefix = path.join(os.homedir(), '.rubies', `${engine}-${version}`)
  }

  const parentDir = path.dirname(rubyPrefix)

  // Set the PATH now, so the MSYS2 'tar' is in Path on Windows
  common.setupPath([path.join(rubyPrefix, 'bin')])

  await io.rmRF(rubyPrefix)
  await io.mkdirP(parentDir)

  const downloadPath = await common.measure('Downloading Ruby', async () => {
    const url = getDownloadURL(platform, engine, version)
    console.log(url)
    return await tc.downloadTool(url)
  })

  await common.measure('Extracting Ruby', async () => {
    if (windows) {
      // Windows 2016 doesn't have system tar, use MSYS2's, it needs unix style paths
      await exec.exec('tar', [ '-xz', '-C', common.win2nix(parentDir), '-f', common.win2nix(downloadPath) ])
    } else {
      await exec.exec('tar', [ '-xz', '-C', parentDir, '-f',  downloadPath ])
    }
  })

  return rubyPrefix
}

function getDownloadURL(platform, engine, version) {
  let builderPlatform = platform
  if (platform.startsWith('windows-')) {
    builderPlatform = 'windows-latest'
  } else if (platform.startsWith('macos-')) {
    builderPlatform = 'macos-latest'
  }

  if (common.isHeadVersion(version)) {
    return getLatestHeadBuildURL(builderPlatform, engine, version)
  } else {
    return `${releasesURL}/download/${builderReleaseTag}/${engine}-${version}-${builderPlatform}.tar.gz`
  }
}

function getLatestHeadBuildURL(platform, engine, version) {
  return `https://github.com/ruby/${engine}-dev-builder/releases/latest/download/${engine}-${version}-${platform}.tar.gz`
}
