const fs = require('fs')
const path = require('path')
const core = require('@actions/core')
const exec = require('@actions/exec')
const io = require('@actions/io')
const cache = require('@actions/cache')
const semver = require('semver')
const common = require('./common')

export const DEFAULT_CACHE_VERSION = '0'

function isValidBundlerVersion(bundlerVersion) {
  return /^\d+(?:\.\d+){0,2}/.test(bundlerVersion) && !bundlerVersion.endsWith('.dev')
}

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
      if (nextLine) {
        const bundlerVersion = nextLine.trim()
        if (isValidBundlerVersion(bundlerVersion)) {
          console.log(`Using Bundler ${bundlerVersion} from ${lockFile} BUNDLED WITH ${bundlerVersion}`)
          return bundlerVersion
        } else {
          console.log(`Could not parse BUNDLED WITH version as a valid Bundler release, ignoring it: ${bundlerVersion}`)
        }
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

export async function installBundler(bundlerVersionInput, rubygemsInputSet, systemRubyUsed, lockFile, platform, rubyPrefix, engine, rubyVersion) {
  let bundlerVersion = bundlerVersionInput

  if (rubygemsInputSet && (bundlerVersion === 'default' || bundlerVersion === 'Gemfile.lock')) {
    console.log('Using the Bundler installed by updating RubyGems')
    return 'unknown'
  }

  if (bundlerVersion === 'Gemfile.lock') {
    let bundlerVersionFromGemfileLock = readBundledWithFromGemfileLock(lockFile)

    if (bundlerVersionFromGemfileLock) {
      bundlerVersion = bundlerVersionFromGemfileLock
    } else {
      bundlerVersion = 'default'
    }
  }

  const floatVersion = common.floatVersion(rubyVersion)

  if (bundlerVersion === 'default') {
    if (systemRubyUsed) {
      if (await io.which('bundle', false)) {
        bundlerVersion = await getBundlerVersion()
        if (semver.lt(semver.coerce(bundlerVersion), '2.2.0')) {
          console.log('Using latest Bundler because the system Bundler is too old')
          bundlerVersion = 'latest'
        } else {
          console.log(`Using system Bundler ${bundlerVersion}`)
          return bundlerVersion
        }
      } else {
        console.log('Installing latest Bundler as we could not find a system Bundler')
        bundlerVersion = 'latest'
      }
    } else if (common.isBundler2dot2Default(engine, rubyVersion)) {
      if (common.windows && engine === 'ruby' && (common.isStableVersion(engine, rubyVersion) || rubyVersion === 'head')) {
        // https://github.com/ruby/setup-ruby/issues/371
        console.log(`Installing latest Bundler for ${engine}-${rubyVersion} on Windows because bin/bundle does not work in bash otherwise`)
        bundlerVersion = 'latest'
      } else {
        console.log(`Using Bundler 2 shipped with ${engine}-${rubyVersion}`)
        return '2'
      }
    } else if (common.hasBundlerDefaultGem(engine, rubyVersion)) {
      // Those Rubies have a old Bundler default gem < 2.2 which does not work well for `gem 'foo', github: 'foo/foo'`:
      // https://github.com/ruby/setup-ruby/issues/358#issuecomment-1195899304
      // Also, Ruby 2.6 would get Bundler 1 yet Ruby 2.3 - 2.5 get latest Bundler 2 which might be unexpected.
      console.log(`Using latest Bundler for ${engine}-${rubyVersion} because the default Bundler gem is too old for that Ruby version`)
      bundlerVersion = 'latest'
    } else {
      bundlerVersion = 'latest'
    }
  }

  if (bundlerVersion === 'latest') {
    bundlerVersion = '2'
  }

  if (isValidBundlerVersion(bundlerVersion)) {
    // OK - input is a 1, 2, or 3 part version number
  } else {
    throw new Error(`Cannot parse bundler input: ${bundlerVersion}`)
  }

  // Use Bundler 1 when we know Bundler 2 does not work
  if (bundlerVersion.startsWith('2')) {
    if (engine === 'ruby' && floatVersion <= 2.2) {
      console.log('Bundler 2 requires Ruby 2.3+, using Bundler 1 on Ruby <= 2.2')
      bundlerVersion = '1'
    } else if (engine === 'ruby' && /^2\.3\.[01]/.test(rubyVersion)) {
      console.log('Ruby 2.3.0 and 2.3.1 have shipped with an old rubygems that only works with Bundler 1')
      bundlerVersion = '1'
    } else if (engine === 'jruby' && rubyVersion.startsWith('9.1')) { // JRuby 9.1 targets Ruby 2.3, treat it the same
      console.log('JRuby 9.1 has a bug with Bundler 2 (https://github.com/ruby/setup-ruby/issues/108), using Bundler 1 instead on JRuby 9.1')
      bundlerVersion = '1'
    }
  }

  const targetRubyVersion = common.targetRubyVersion(engine, rubyVersion)
  // Use Bundler 2.3 when we use Ruby 2.3.2 - 2.5
  // Use Bundler 2.4 when we use Ruby 2.6-2.7
  if (bundlerVersion == '2') {
    if (targetRubyVersion <= 2.5) { // < 2.3.2 already handled above
      console.log('Ruby 2.3.2 - 2.5 only works with Bundler 2.3')
      bundlerVersion = '2.3'
    } else if (targetRubyVersion <= 2.7) {
      console.log('Ruby 2.6-2.7 only works with Bundler 2.4')
      bundlerVersion = '2.4'
    }
  }

  const gem = path.join(rubyPrefix, 'bin', 'gem')
  // Workaround for https://github.com/rubygems/rubygems/issues/5245
  // and for https://github.com/oracle/truffleruby/issues/2780
  const force = ((platform.startsWith('windows-') && engine === 'ruby' && floatVersion >= 3.1) || (engine === 'truffleruby')) ? ['--force'] : []

  const versionParts = [...bundlerVersion.matchAll(/\d+/g)].length
  const bundlerVersionConstraint = versionParts >= 3 ? bundlerVersion : `~> ${bundlerVersion}.0`

  const args = ['install', 'bundler', ...force, '-v', bundlerVersionConstraint]

  let stderr = ''
  try {
    await exec.exec(gem, args, {
      listeners: {
        stderr: (data) => (stderr += data.toString())
      }
    })
  } catch (error) {
    if (systemRubyUsed && stderr.includes('Gem::FilePermissionError')) {
      await exec.exec('sudo', [gem, ...args]);
    } else {
      throw error
    }
  }

  return bundlerVersion
}

async function getBundlerVersion() {
  let bundlerVersion = ''
  await exec.exec('bundle', ['--version'], {
    silent: true,
    listeners: {
      stdout: (data) => (bundlerVersion += data.toString())
    }
  })
  return bundlerVersion.replace(/^Bundler version /, '').trim()
}

export async function bundleInstall(gemfile, lockFile, platform, engine, rubyVersion, bundlerVersion, cacheVersion, systemRubyUsed) {
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
  const baseKey = await computeBaseKey(platform, engine, rubyVersion, lockFile, cacheVersion, systemRubyUsed)
  const key = `${baseKey}-${await common.hashFile(lockFile)}`
  // If only Gemfile.lock changes we can reuse part of the cache, and clean old gem versions below
  const restoreKeys = [`${baseKey}-`]
  console.log(`Cache key: ${key}`)

  // restore cache & install
  let cachedKey = null
  try {
    // .slice() to workaround https://github.com/actions/toolkit/issues/1377
    cachedKey = await cache.restoreCache(paths.slice(), key, restoreKeys)
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

async function computeBaseKey(platform, engine, version, lockFile, cacheVersion, systemRubyUsed) {
  const cwd = process.cwd()
  const bundleWith = process.env['BUNDLE_WITH'] || ''
  const bundleWithout = process.env['BUNDLE_WITHOUT'] || ''
  const bundleOnly = process.env['BUNDLE_ONLY'] || ''
  let key = `setup-ruby-bundler-cache-v6-${common.getOSNameVersionArch()}-${engine}-${version}-wd-${cwd}-with-${bundleWith}-without-${bundleWithout}-only-${bundleOnly}`

  if (cacheVersion !== DEFAULT_CACHE_VERSION) {
    key += `-v-${cacheVersion}`
  }

  if (common.isHeadVersion(version)) {
    if (engine !== 'jruby') {
      let print_abi = "print RbConfig::CONFIG['ruby_version']"
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

  if (systemRubyUsed) {
    let platform = ''
    await exec.exec('ruby', ['-e', 'print RUBY_PLATFORM'], {
      silent: true,
      listeners: {
        stdout: (data) => {
          platform += data.toString();
        }
      }
    });
    key += `-platform-${platform}`
  }

  key += `-${lockFile}`
  return key
}
