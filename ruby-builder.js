const os = require('os')
const fs = require('fs')
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
  return rubyBuilderVersions[engine]
}

export async function install(platform, engine, version) {
  let rubyPrefix, inToolCache
  if (common.shouldUseToolCache(engine, version)) {
    inToolCache = common.toolCacheFind(engine, version)
    if (inToolCache) {
      rubyPrefix = inToolCache
    } else {
      const toolCacheRubyPrefix = common.getToolCacheRubyPrefix(platform, engine, version)
      if (common.isSelfHostedRunner()) {
        const rubyBuildDefinition = engine === 'ruby' ? version : `${engine}-${version}`
        core.error(
          `The current runner (${common.getOSNameVersionArch()}) was detected as self-hosted because ${common.selfHostedRunnerReason()}.\n` +
          `In such a case, you should install Ruby in the $RUNNER_TOOL_CACHE yourself, for example using https://github.com/rbenv/ruby-build\n` +
          `You can take inspiration from this workflow for more details: https://github.com/ruby/ruby-builder/blob/master/.github/workflows/build.yml\n` +
          `$ ruby-build ${rubyBuildDefinition} ${toolCacheRubyPrefix}\n` +
          `Once that completes successfully, mark it as complete with:\n` +
          `$ touch ${common.toolCacheCompleteFile(toolCacheRubyPrefix)}\n` +
          `It is your responsibility to ensure installing Ruby like that is not done in parallel.\n`)
        process.exit(1)
      } else {
        rubyPrefix = toolCacheRubyPrefix
      }
    }
  } else if (windows) {
    rubyPrefix = path.join(`${common.drive}:`, `${engine}-${version}`)
  } else {
    rubyPrefix = path.join(os.homedir(), '.rubies', `${engine}-${version}`)
  }

  // Set the PATH now, so the MSYS2 'tar' is in Path on Windows
  common.setupPath([path.join(rubyPrefix, 'bin')])

  if (!inToolCache) {
    await io.mkdirP(rubyPrefix)
    if (engine === 'truffleruby+graalvm') {
      await installWithRubyBuild(engine, version, rubyPrefix)
    } else {
      await downloadAndExtract(platform, engine, version, rubyPrefix)
    }
  }

  return rubyPrefix
}

async function installWithRubyBuild(engine, version, rubyPrefix) {
  const tmp = process.env['RUNNER_TEMP'] || os.tmpdir()
  const rubyBuildDir = path.join(tmp, 'ruby-build-for-setup-ruby')
  await common.measure('Cloning ruby-build', async () => {
    await exec.exec('git', ['clone', 'https://github.com/rbenv/ruby-build.git', rubyBuildDir])
  })

  const rubyName = `${engine}-${version === 'head' ? 'dev' : version}`
  await common.measure(`Installing ${engine}-${version} with ruby-build`, async () => {
    await exec.exec(`${rubyBuildDir}/bin/ruby-build`, [rubyName, rubyPrefix])
  })

  await io.rmRF(rubyBuildDir)
}

async function downloadAndExtract(platform, engine, version, rubyPrefix) {
  const parentDir = path.dirname(rubyPrefix)

  const downloadPath = await common.measure('Downloading Ruby', async () => {
    const url = getDownloadURL(platform, engine, version)
    console.log(url)
    return await tc.downloadTool(url)
  })

  await common.measure('Extracting  Ruby', async () => {
    if (windows) {
      // Windows 2016 doesn't have system tar, use MSYS2's, it needs unix style paths
      await exec.exec('tar', ['-xz', '-C', common.win2nix(parentDir), '-f', common.win2nix(downloadPath)])
    } else {
      await exec.exec('tar', ['-xz', '-C', parentDir, '-f', downloadPath])
    }
  })

  if (common.shouldUseToolCache(engine, version)) {
    common.createToolCacheCompleteFile(rubyPrefix)
  }
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
