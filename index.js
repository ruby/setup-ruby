const os = require('os')
const fs = require('fs')
const path = require('path')
const core = require('@actions/core')
const exec = require('@actions/exec')
const cache = require('@actions/cache')
const common = require('./common')

const windows = common.windows

const inputDefaults = {
  'ruby-version': 'default',
  'bundler': 'default',
  'bundler-cache': 'true',
  'working-directory': '.',
}

// entry point when this action is run on its own
export async function run() {
  try {
    await setupRuby()
  } catch (error) {
    core.setFailed(error.message)
  }
}

// entry point when this action is run from other actions
export async function setupRuby(options = {}) {
  const inputs = { ...options }
  for (const key in inputDefaults) {
    if (!Object.prototype.hasOwnProperty.call(inputs, key)) {
      inputs[key] = core.getInput(key) || inputDefaults[key]
    }
  }

  process.chdir(inputs['working-directory'])

  const platform = common.getVirtualEnvironmentName()
  const [engine, parsedVersion] = parseRubyEngineAndVersion(inputs['ruby-version'])

  let installer
  if (platform === 'windows-latest' && engine !== 'jruby') {
    installer = require('./windows')
  } else {
    installer = require('./ruby-builder')
  }

  const engineVersions = installer.getAvailableVersions(platform, engine)
  const version = validateRubyEngineAndVersion(platform, engineVersions, engine, parsedVersion)

  createGemRC()
  envPreInstall()

  const rubyPrefix = await installer.install(platform, engine, version)

  // When setup-ruby is used by other actions, this allows code in them to run
  // before 'bundle install'.  Installed dependencies may require additional
  // libraries & headers, build tools, etc.
  if (inputs['afterSetupPathHook'] instanceof Function) {
    await inputs['afterSetupPathHook']({ platform, rubyPrefix, engine, version })
  }

  if (inputs['bundler'] !== 'none') {
    const [gemfile, lockFile] = detectGemfiles()

    await common.measure('Installing Bundler', async () =>
      installBundler(inputs['bundler'], lockFile, platform, rubyPrefix, engine, version))

    if (inputs['bundler-cache'] === 'true') {
      await common.measure('bundle install', async () =>
          bundleInstall(gemfile, lockFile, platform, engine, version))
    }
  }

  core.setOutput('ruby-prefix', rubyPrefix)
}

function detectGemfiles() {
  const gemfilePath = process.env['BUNDLE_GEMFILE'] || 'Gemfile'
  if (fs.existsSync(gemfilePath)) {
    const lockPath = `${gemfilePath}.lock`
    if (fs.existsSync(lockPath)) {
      return [gemfilePath, lockPath]
    } else {
      return [gemfilePath, null]
    }
  }

  const gemsRbPath = "gems.rb"
  if (fs.existsSync(gemsRbPath)) {
    const lockPath = "gems.locked"
    if (fs.existsSync(lockPath)) {
      return [gemsRbPath, lockPath]
    } else {
      return [gemsRbPath, null]
    }
  }

  return [null, null]
}

function parseRubyEngineAndVersion(rubyVersion) {
  if (rubyVersion === 'default') {
    if (fs.existsSync('.ruby-version')) {
      rubyVersion = '.ruby-version'
    } else if (fs.existsSync('.tool-versions')) {
      rubyVersion = '.tool-versions'
    } else {
      throw new Error('input ruby-version needs to be specified if no .ruby-version or .tool-versions file exists')
    }
  }

  if (rubyVersion === '.ruby-version') { // Read from .ruby-version
    rubyVersion = fs.readFileSync('.ruby-version', 'utf8').trim()
    console.log(`Using ${rubyVersion} as input from file .ruby-version`)
  } else if (rubyVersion === '.tool-versions') { // Read from .tool-versions
    const toolVersions = fs.readFileSync('.tool-versions', 'utf8').trim()
    const rubyLine = toolVersions.split(/\r?\n/).filter(e => e.match(/^ruby\s/))[0]
    rubyVersion = rubyLine.split(/\s+/, 2)[1]
    console.log(`Using ${rubyVersion} as input from file .tool-versions`)
  }

  let engine, version
  if (rubyVersion.match(/^(\d+)/) || common.isHeadVersion(rubyVersion)) { // X.Y.Z => ruby-X.Y.Z
    engine = 'ruby'
    version = rubyVersion
  } else if (!rubyVersion.includes('-')) { // myruby -> myruby-stableVersion
    engine = rubyVersion
    version = '' // Let the logic below find the version
  } else { // engine-X.Y.Z
    [engine, version] = rubyVersion.split('-', 2)
  }

  return [engine, version]
}

function validateRubyEngineAndVersion(platform, engineVersions, engine, parsedVersion) {
  if (!engineVersions) {
    throw new Error(`Unknown engine ${engine} on ${platform}`)
  }

  let version = parsedVersion
  if (!engineVersions.includes(parsedVersion)) {
    const latestToFirstVersion = engineVersions.slice().reverse()
    const found = latestToFirstVersion.find(v => !common.isHeadVersion(v) && v.startsWith(parsedVersion))
    if (found) {
      version = found
    } else {
      throw new Error(`Unknown version ${parsedVersion} for ${engine} on ${platform}
        available versions for ${engine} on ${platform}: ${engineVersions.join(', ')}
        File an issue at https://github.com/ruby/setup-ruby/issues if would like support for a new version`)
    }
  }

  return version
}

function createGemRC() {
  const gemrc = path.join(os.homedir(), '.gemrc')
  if (!fs.existsSync(gemrc)) {
    fs.writeFileSync(gemrc, `gem: --no-document${os.EOL}`)
  }
}

// sets up ENV variables
// currently only used on Windows runners
function envPreInstall() {
  const ENV = process.env
  if (windows) {
    // puts normal Ruby temp folder on SSD
    core.exportVariable('TMPDIR', ENV['RUNNER_TEMP'])
    // bash - sets home to match native windows, normally C:\Users\<user name>
    core.exportVariable('HOME', ENV['HOMEDRIVE'] + ENV['HOMEPATH'])
    // bash - needed to maintain Path from Windows
    core.exportVariable('MSYS2_PATH_TYPE', 'inherit')
  }
}

function readBundledWithFromGemfileLock(lockFile) {
  if (lockFile !== null) {
    const contents = fs.readFileSync(lockFile, 'utf8')
    const lines = contents.split(/\r?\n/)
    const bundledWithLine = lines.findIndex(line => /^BUNDLED WITH$/.test(line.trim()))
    if (bundledWithLine !== -1) {
      const nextLine = lines[bundledWithLine+1]
      if (nextLine && /^\d+/.test(nextLine.trim())) {
        const bundlerVersion = nextLine.trim()
        const majorVersion = bundlerVersion.match(/^\d+/)[0]
        console.log(`Using Bundler ${majorVersion} from ${lockFile} BUNDLED WITH ${bundlerVersion}`)
        return majorVersion
      }
    }
  }
  return null
}

async function installBundler(bundlerVersionInput, lockFile, platform, rubyPrefix, engine, rubyVersion) {
  var bundlerVersion = bundlerVersionInput

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

  if (rubyVersion.match(/^2\.[12]/)) {
    console.log('Bundler 2 requires Ruby 2.3+, using Bundler 1 on Ruby <= 2.2')
    bundlerVersion = '1'
  } else if (rubyVersion.startsWith('2.3')) {
    console.log('Ruby 2.3 has a bug with Bundler 2 (https://github.com/rubygems/rubygems/issues/3570), using Bundler 1 instead on Ruby 2.3')
    bundlerVersion = '1'
  }

  if (engine === 'ruby' && common.isHeadVersion(rubyVersion) && bundlerVersion === '2') {
    console.log(`Using Bundler 2 shipped with ${engine}-${rubyVersion}`)
  } else if (engine === 'truffleruby' && bundlerVersion === '1') {
    console.log(`Using Bundler 1 shipped with ${engine}`)
  } else if (engine === 'rubinius') {
    console.log(`Rubinius only supports the version of Bundler shipped with it`)
  } else {
    const gem = path.join(rubyPrefix, 'bin', 'gem')
    await exec.exec(gem, ['install', 'bundler', '-v', `~> ${bundlerVersion}`, '--no-document'])
  }
}

async function bundleInstall(gemfile, lockFile, platform, engine, version) {
  if (gemfile === null) {
    console.log('Could not determine gemfile path, skipping "bundle install" and caching')
    return false
  }

  // config
  const path = 'vendor/bundle'

  if (lockFile !== null) {
    await exec.exec('bundle', ['config', '--local', 'deployment', 'true'])
  }
  await exec.exec('bundle', ['config', '--local', 'path', path])

  // cache key
  const paths = [path]
  const baseKey = await computeBaseKey(platform, engine, version)
  let key = baseKey
  let restoreKeys
  if (lockFile !== null) {
    key += `-${lockFile}-${await common.hashFile(lockFile)}`
    // If only Gemfile.lock we can reuse some of the cache (but it will keep old gem versions in the cache)
    restoreKeys = [`${baseKey}-${lockFile}-`]
  } else {
    // Only exact key, to never mix native gems of different platforms or Ruby versions
    restoreKeys = []
  }
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

  let alreadyInstalled = false
  if (cachedKey === key) {
    const exitCode = await exec.exec('bundle', ['check'], { ignoreReturnCode: true })
    alreadyInstalled = (exitCode === 0)
  }

  if (!alreadyInstalled) {
    await exec.exec('bundle', ['install', '--jobs', '4'])

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

async function computeBaseKey(platform, engine, version) {
  let baseKey = `setup-ruby-bundle-install-${platform}-${engine}-${version}`
  if (engine !== 'jruby' && common.isHeadVersion(version)) {
    let revision = '';
    await exec.exec('ruby', ['-e', 'print RUBY_REVISION'], {
      silent: true,
      listeners: {
        stdout: (data) => {
          revision += data.toString();
        }
      }
    });
    baseKey += `-revision-${revision}`
  }
  return baseKey
}

if (__filename.endsWith('index.js')) { run() }
