const os = require('os')
const fs = require('fs')
const path = require('path')
const core = require('@actions/core')
const exec = require('@actions/exec')
const io = require('@actions/io')
const common = require('./common')
const rubyBuilderVersions = require('./ruby-builder-versions')

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

  const paths = [path.join(rubyPrefix, 'bin')]

  // JRuby can use compiled extension code via ffi, so make sure gcc exists.
  if (platform.startsWith('windows') && engine === 'jruby') {
    paths.push(...await require('./windows').installJRubyTools())
  }

  // Set the PATH now, so the MSYS2 'tar' is in Path on Windows
  common.setupPath(paths)

  if (!inToolCache) {
    await io.mkdirP(rubyPrefix)
    await downloadAndExtract(platform, engine, version, rubyPrefix)
  }

  // Ensure JRuby has minimum Java version to run
  if (engine === "jruby") {
    await common.setupJavaHome(rubyPrefix)
  }

  return rubyPrefix
}

async function downloadAndExtract(platform, engine, version, rubyPrefix) {
  const parentDir = path.dirname(rubyPrefix)

  const downloadPath = await common.measure('Downloading Ruby', async () => {
    const url = getDownloadURL(platform, engine, version)
    console.log(url)
    try {
      return await common.download(url)
    } catch (error) {
      if (error.message.includes('404')) {
        throw new Error(`Unavailable version ${version} for ${engine} on ${platform}
          ${await unavailableVersionHint(platform, engine, version)}
          Cause: ${error.message}`)
      } else {
        throw error
      }
    }
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

// Newer runner images usually only have builds of the latest patch release of each series,
// so point to that release if it is available, or explain that the series is not available.
async function unavailableVersionHint(platform, engine, version) {
  const request = 'You can request it at https://github.com/ruby/setup-ruby/issues'
  const series = version.split('.').slice(0, 2).join('.')
  const latest = getAvailableVersions(platform, engine)
    .filter(v => v.startsWith(`${series}.`) && common.isStableVersion(engine, v))
    .pop()
  if (common.isHeadVersion(version) || latest === undefined) {
    return request
  }

  const input = v => engine === 'ruby' ? v : `${engine}-${v}`
  if (latest !== version) {
    let response
    try {
      response = await fetch(getDownloadURL(platform, engine, latest), { method: 'HEAD', signal: AbortSignal.timeout(10000) })
    } catch {
      return request
    }
    if (response.ok) {
      return `Only the latest patch release of each series is built for newer runner images.
          ${engine}-${latest} is available on ${platform}: use ruby-version: '${input(latest)}', or '${input(series)}' to always use the latest ${series}.x release.`
    } else if (response.status !== 404) {
      return request
    }
  }

  const latestUnavailable = latest === version
    ? `${engine}-${version} is the latest ${series}.x release.`
    : `${engine}-${latest}, the latest ${series}.x release, is not available on ${platform} either.`
  return `${latestUnavailable}
          Use a newer ${engine} version on ${platform}, or an older runner image for ${engine} ${series}.
          Note that ubuntu-latest and macos-latest move to newer runner images over time.`
}

function getDownloadURL(platform, engine, version) {
  let builderPlatform = null
  if (platform.startsWith('windows-')) {
    builderPlatform = `windows-${os.arch()}`
  } else if (platform.startsWith('macos-')) {
    builderPlatform = `darwin-${os.arch()}`
  } else if (platform.startsWith('ubuntu-')) {
    builderPlatform = `${platform}-${os.arch()}`
  }

  if (builderPlatform === null || !['x64', 'arm64'].includes(os.arch())) {
    throw new Error(`Unknown download URL for platform ${platform}-${os.arch()}`)
  }

  if (common.isHeadVersion(version)) {
    return getLatestHeadBuildURL(builderPlatform, engine, version)
  } else {
    return `${releasesURL}/download/${engine}-${version}/${engine}-${version}-${builderPlatform}.tar.gz`
  }
}

function getLatestHeadBuildURL(platform, engine, version) {
  var repo = `${engine}-dev-builder`
  if (engine === 'truffleruby+graalvm') {
    repo = 'truffleruby-dev-builder'
  }
  return `https://github.com/ruby/${repo}/releases/latest/download/${engine}-${version}-${platform}.tar.gz`
}
