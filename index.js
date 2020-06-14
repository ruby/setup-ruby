const os = require('os')
const fs = require('fs')
const path = require('path')
const core = require('@actions/core')
const exec = require('@actions/exec')
const cache = require('@actions/cache')
const common = require('./common')

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
    if (!inputs.hasOwnProperty(key)) {
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

  const [rubyPrefix, newPathEntries] = await installer.install(platform, engine, version)

  setupPath(newPathEntries)

  // When setup-ruby is used by other actions, this allows code in them to run
  // before 'bundle install'.  Installed dependencies may require additional
  // libraries & headers, build tools, etc.
  if (inputs['afterSetupPathHook'] instanceof Function) {
    await inputs['afterSetupPathHook']({ platform, rubyPrefix, engine, version })
  }

  if (inputs['bundler'] !== 'none') {
    await common.measure('Installing Bundler', async () =>
      installBundler(inputs['bundler'], platform, rubyPrefix, engine, version))

    if (inputs['bundler-cache'] === 'true') {
      await common.measure('bundle install', async () =>
          bundleInstall(platform, engine, version))
    }
  }

  core.setOutput('ruby-prefix', rubyPrefix)
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

function setupPath(newPathEntries) {
  const originalPath = process.env['PATH'].split(path.delimiter)
  let cleanPath = originalPath.filter(entry => !/\bruby\b/i.test(entry))

  if (cleanPath.length !== originalPath.length) {
    core.startGroup('Cleaning PATH')
    console.log('Entries removed from PATH to avoid conflicts with Ruby:')
    for (const entry of originalPath) {
      if (!cleanPath.includes(entry)) {
        console.log(`  ${entry}`)
      }
    }
    core.endGroup()
  }

  core.exportVariable('PATH', [...newPathEntries, ...cleanPath].join(path.delimiter))
}

function readBundledWithFromGemfileLock() {
  if (fs.existsSync('Gemfile.lock')) {
    const contents = fs.readFileSync('Gemfile.lock', 'utf8')
    const lines = contents.split(/\r?\n/)
    const bundledWithLine = lines.findIndex(line => /^BUNDLED WITH$/.test(line.trim()))
    if (bundledWithLine !== -1) {
      const nextLine = lines[bundledWithLine+1]
      if (nextLine && /^\d+/.test(nextLine.trim())) {
        const bundlerVersion = nextLine.trim()
        const majorVersion = bundlerVersion.match(/^\d+/)[0]
        console.log(`Using Bundler ${majorVersion} from Gemfile.lock BUNDLED WITH ${bundlerVersion}`)
        return majorVersion
      }
    }
  }
  return null
}

async function installBundler(bundlerVersionInput, platform, rubyPrefix, engine, rubyVersion) {
  var bundlerVersion = bundlerVersionInput

  if (bundlerVersion === 'default' || bundlerVersion === 'Gemfile.lock') {
    bundlerVersion = readBundledWithFromGemfileLock()
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

  if (rubyVersion.startsWith('2.2')) {
    console.log('Bundler 2 requires Ruby 2.3+, using Bundler 1 on Ruby 2.2')
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

async function bundleInstall(platform, engine, version) {
  if (!fs.existsSync('Gemfile')) {
    console.log('No Gemfile, skipping "bundle install" and caching')
    return
  }

  // config
  const path = 'vendor/bundle'
  const hasGemfileLock = fs.existsSync('Gemfile.lock');
  if (hasGemfileLock) {
    await exec.exec('bundle', ['config', '--local', 'deployment', 'true'])
  }
  await exec.exec('bundle', ['config', '--local', 'path', path])

  // cache key
  const paths = [path]
  const baseKey = await computeBaseKey(platform, engine, version)
  let key = baseKey
  let restoreKeys
  if (hasGemfileLock) {
    key += `-Gemfile.lock-${await common.hashFile('Gemfile.lock')}`
    // If only Gemfile.lock we can reuse some of the cache (but it will keep old gem versions in the cache)
    restoreKeys = [`${baseKey}-Gemfile.lock-`]
  } else {
    // Only exact key, to never mix native gems of different platforms or Ruby versions
    restoreKeys = []
  }
  console.log(`Cache key: ${key}`)

  // restore cache & install
  const cachedKey = await cache.restoreCache(paths, key, restoreKeys)
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
}

async function computeBaseKey(platform, engine, version) {
  let baseKey = `setup-ruby-bundle-install-${platform}-${engine}-${version}`
  if (engine === 'ruby' && common.isHeadVersion(version)) {
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
