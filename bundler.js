const fs = require('fs')
const path = require('path')
const core = require('@actions/core')
const exec = require('@actions/exec')
const cache = require('@actions/cache')
const common = require('./common')

export const DEFAULT_CACHE_VERSION = '0'

// The returned gemfile is guaranteed to exist, the lockfile might not exist
export function detectGemfiles() {
  const gemfilePath = process.env['BUNDLE_GEMFILE'] || 'Gemfile'
  if (fs.existsSync(gemfilePath)) {
    return [gemfilePath, `${gemfilePath}.lock`]
  } else if (process.env['BUNDLE_GEMFILE']) {
    throw new Error(`$BUNDLE_GEMFILE is set to ${gemfilePath} but does not exist`)
  }

  if (fs.existsSync("gems.rb")) {
    return ["gems.rb", "gems.locked"]
  }

  return [null, null]
}

function readBundledWithFromGemfileLock(lockFile) {
  if (lockFile !== null && fs.existsSync(lockFile)) {
    const contents = fs.readFileSync(lockFile, 'utf8')
    const lines = contents.split(/\r?\n/)
    const bundledWithLine = lines.findIndex(line => /^BUNDLED WITH$/.test(line.trim()))
    if (bundledWithLine !== -1) {
      const nextLine = lines[bundledWithLine+1]
      if (nextLine && /^\d+/.test(nextLine.trim())) {
        const bundlerVersion = nextLine.trim()
        console.log(`Using Bundler ${bundlerVersion} from ${lockFile} BUNDLED WITH ${bundlerVersion}`)
        return bundlerVersion
      }
    }
  }
  return null
}

async function afterLockFile(lockFile, platform, engine, rubyVersion) {
  if (engine.startsWith('truffleruby') && common.floatVersion(rubyVersion) < 21.1 && platform.startsWith('ubuntu-')) {
    const contents = fs.readFileSync(lockFile, 'utf8')
    if (contents.includes('nokogiri')) {
      await common.measure('Installing libxml2-dev libxslt-dev, required to install nokogiri on TruffleRuby < 21.1', async () =>
        exec.exec('sudo', ['apt-get', '-yqq', 'install', 'libxml2-dev', 'libxslt-dev'], { silent: true }))
    }
  }
}

export async function installBundler(bundlerVersionInput, lockFile, platform, rubyPrefix, engine, rubyVersion) {
  let bundlerVersion = bundlerVersionInput

  if (bundlerVersion === 'default' || bundlerVersion === 'Gemfile.lock') {
    bundlerVersion = readBundledWithFromGemfileLock(lockFile)

    if (!bundlerVersion) {
      bundlerVersion = 'latest'
    }
  }

  if (bundlerVersion === 'latest') {
    bundlerVersion = '2'
  }

  if (/^\d+/.test(bundlerVersion)) {
    // OK
  } else {
    throw new Error(`Cannot parse bundler input: ${bundlerVersion}`)
  }

  if (engine === 'ruby' && common.floatVersion(rubyVersion) <= 2.2) {
    console.log('Bundler 2 requires Ruby 2.3+, using Bundler 1 on Ruby <= 2.2')
    bundlerVersion = '1'
  } else if (engine === 'ruby' && /^2\.3\.[01]/.test(rubyVersion)) {
    console.log('Ruby 2.3.0 and 2.3.1 have shipped with an old rubygems that only works with Bundler 1')
    bundlerVersion = '1'
  } else if (engine === 'jruby' && rubyVersion.startsWith('9.1')) { // JRuby 9.1 targets Ruby 2.3, treat it the same
    console.log('JRuby 9.1 has a bug with Bundler 2 (https://github.com/ruby/setup-ruby/issues/108), using Bundler 1 instead on JRuby 9.1')
    bundlerVersion = '1'
  }

  if (common.isHeadVersion(rubyVersion) && common.isBundler2Default(engine, rubyVersion) && bundlerVersion.startsWith('2')) {
    // Avoid installing a newer Bundler version for head versions as it might not work.
    // For releases, even if they ship with Bundler 2 we install the latest Bundler.
    console.log(`Using Bundler 2 shipped with ${engine}-${rubyVersion}`)
  } else if (engine.startsWith('truffleruby') && common.isBundler1Default(engine, rubyVersion) && bundlerVersion.startsWith('1')) {
    console.log(`Using Bundler 1 shipped with ${engine}-${rubyVersion}`)
  } else {
    const gem = path.join(rubyPrefix, 'bin', 'gem')
    const bundlerVersionConstraint = /^\d+\.\d+\.\d+/.test(bundlerVersion) ? bundlerVersion : `~> ${bundlerVersion}`
    // Workaround for https://github.com/rubygems/rubygems/issues/5245
    const force = (platform.startsWith('windows-') && engine === 'ruby' && common.floatVersion(rubyVersion) >= 3.1) ? ['--force'] : []
    await exec.exec(gem, ['install', 'bundler', ...force, '-v', bundlerVersionConstraint])
  }

  return bundlerVersion
}

export async function bundleInstall(gemfile, lockFile, platform, engine, rubyVersion, bundlerVersion, cacheVersion) {
  if (gemfile === null) {
    console.log('Could not determine gemfile path, skipping "bundle install" and caching')
    return false
  }

  let envOptions = {}
  if (bundlerVersion.startsWith('1') && common.isBundler2Default(engine, rubyVersion)) {
    // If Bundler 1 is specified on Rubies which ship with Bundler 2,
    // we need to specify which Bundler version to use explicitly until the lockfile exists.
    console.log(`Setting BUNDLER_VERSION=${bundlerVersion} for "bundle config|lock" commands below to ensure Bundler 1 is used`)
    envOptions = { env: { ...process.env, BUNDLER_VERSION: bundlerVersion } }
  }

  // config
  const cachePath = 'vendor/bundle'
  // An absolute path, so it is reliably under $PWD/vendor/bundle, and not relative to the gemfile's directory
  const bundleCachePath = path.join(process.cwd(), cachePath)

  await exec.exec('bundle', ['config', '--local', 'path', bundleCachePath], envOptions)

  if (fs.existsSync(lockFile)) {
    await exec.exec('bundle', ['config', '--local', 'deployment', 'true'], envOptions)
  } else {
    // Generate the lockfile so we can use it to compute the cache key.
    // This will also automatically pick up the latest gem versions compatible with the Gemfile.
    await exec.exec('bundle', ['lock'], envOptions)
  }

  await afterLockFile(lockFile, platform, engine, rubyVersion)

  // cache key
  const paths = [cachePath]
  const baseKey = await computeBaseKey(platform, engine, rubyVersion, lockFile, cacheVersion)
  const key = `${baseKey}-${await common.hashFile(lockFile)}`
  // If only Gemfile.lock changes we can reuse part of the cache, and clean old gem versions below
  const restoreKeys = [`${baseKey}-`]
  console.log(`Cache key: ${key}`)

  // restore cache & install
  let cachedKey = null
  try {
    cachedKey = await cache.restoreCache(paths, key, restoreKeys)
  } catch (error) {
    if (error.name === cache.ValidationError.name) {
      throw error;
    } else {
      core.info(`[warning] There was an error restoring the cache ${error.message}`)
    }
  }

  if (cachedKey) {
    console.log(`Found cache for key: ${cachedKey}`)
  }

  // Always run 'bundle install' to list the gems
  await exec.exec('bundle', ['install', '--jobs', '4'])

  // @actions/cache only allows to save for non-existing keys
  if (cachedKey !== key) {
    if (cachedKey) { // existing cache but Gemfile.lock differs, clean old gems
      await exec.exec('bundle', ['clean'])
    }

    // Error handling from https://github.com/actions/cache/blob/master/src/save.ts
    console.log('Saving cache')
    try {
      await cache.saveCache(paths, key)
    } catch (error) {
      if (error.name === cache.ValidationError.name) {
        throw error;
      } else if (error.name === cache.ReserveCacheError.name) {
        core.info(error.message);
      } else {
        core.info(`[warning]${error.message}`)
      }
    }
  }

  return true
}

async function computeBaseKey(platform, engine, version, lockFile, cacheVersion) {
  const cacheVersionSuffix = DEFAULT_CACHE_VERSION === cacheVersion ? '' : `-cachever:${cacheVersion}`
  let key = `setup-ruby-bundler-cache-v3-${platform}-${engine}-${version}${cacheVersionSuffix}`

  if (common.isHeadVersion(version)) {
    if (engine !== 'jruby') {
      // CRuby dev versions do not change the ABI version when the ABI changes, so use the commit as the ABI version
      let print_abi = engine === 'ruby' ? 'print RUBY_REVISION' : "print RbConfig::CONFIG['ruby_version']"
      let abi = ''
      await exec.exec('ruby', ['-e', print_abi], {
        silent: true,
        listeners: {
          stdout: (data) => {
            abi += data.toString();
          }
        }
      });
      key += `-ABI-${abi}`
    }
  }

  key += `-${lockFile}`
  return key
}
