const os = require('os')
const fs = require('fs')
const path = require('path')
const core = require('@actions/core')
const exec = require('@actions/exec')
const common = require('./common')
const rubygems = require('./rubygems')
const bundler = require('./bundler')

const windows = common.windows

const inputDefaults = {
  'ruby-version': 'default',
  'rubygems': 'default',
  'bundler': 'Gemfile.lock',
  'bundler-cache': 'false',
  'working-directory': '.',
  'cache-version': bundler.DEFAULT_CACHE_VERSION,
  'self-hosted': 'false',
  'windows-toolchain': 'default',
}

// entry point when this action is run on its own
export async function run() {
  try {
    await setupRuby()
  } catch (error) {
    if (/\bprocess\b.+\bfailed\b/.test(error.message)) {
      core.setFailed(error.message)
    } else {
      core.setFailed(error.stack)
    }
  }
  // Explicit process.exit() to not wait hanging promises,
  // see https://github.com/ruby/setup-ruby/issues/543
  process.exit()
}

// entry point when this action is run from other actions
export async function setupRuby(options = {}) {
  const inputs = { ...options }
  for (const key in inputDefaults) {
    if (!Object.prototype.hasOwnProperty.call(inputs, key)) {
      inputs[key] = core.getInput(key) || inputDefaults[key]
    }
  }
  common.inputs.selfHosted = inputs['self-hosted']

  process.chdir(inputs['working-directory'])

  const platform = common.getOSNameVersion()
  const [engine, parsedVersion] = await parseRubyEngineAndVersion(inputs['ruby-version'])
  const systemRuby = inputs['ruby-version'] === 'system'

  let installer, version
  if (systemRuby) {
    version = parsedVersion
  } else {
    if (platform.startsWith('windows-') && engine === 'ruby' && !common.isSelfHostedRunner()) {
      installer = require('./windows')
    } else {
      installer = require('./ruby-builder')
    }

    const engineVersions = installer.getAvailableVersions(platform, engine)
    version = validateRubyEngineAndVersion(platform, engineVersions, engine, parsedVersion)
  }

  createGemRC(engine, version)
  envPreInstall()

  // JRuby can use compiled extension code, so make sure gcc exists.
  // As of Jan-2022, JRuby compiles against msvcrt.
  if (platform.startsWith('windows') && engine === 'jruby' &&
    !fs.existsSync('C:\\msys64\\mingw64\\bin\\gcc.exe')) {
    await require('./windows').installJRubyTools()
  }

  let rubyPrefix
  if (systemRuby) {
    rubyPrefix = await getSystemRubyPrefix()
  } else {
    rubyPrefix = await installer.install(platform, engine, version)
  }

  await common.measure('Print Ruby version', async () =>
    await exec.exec('ruby', ['--version']))

  const rubygemsInputSet = inputs['rubygems'] !== 'default'
  if (rubygemsInputSet) {
    await common.measure('Updating RubyGems', async () =>
      rubygems.rubygemsUpdate(inputs['rubygems'], rubyPrefix, platform, engine, version))
  }

  // When setup-ruby is used by other actions, this allows code in them to run
  // before 'bundle install'.  Installed dependencies may require additional
  // libraries & headers, build tools, etc.
  if (inputs['afterSetupPathHook'] instanceof Function) {
    await inputs['afterSetupPathHook']({ platform, rubyPrefix, engine, version })
  }

  const [gemfile, lockFile] = bundler.detectGemfiles()
  let bundlerVersion = 'unknown'

  if (inputs['bundler'] !== 'none') {
    bundlerVersion = await common.measure('Installing Bundler', async () =>
      bundler.installBundler(inputs['bundler'], rubygemsInputSet, systemRuby, lockFile, platform, rubyPrefix, engine, version))
  }

  if (inputs['bundler-cache'] === 'true') {
    await common.time('bundle install', async () =>
      bundler.bundleInstall(gemfile, lockFile, platform, engine, version, bundlerVersion, inputs['cache-version'], systemRuby))
  }

  core.setOutput('ruby-prefix', rubyPrefix)
}

async function parseRubyEngineAndVersion(rubyVersion) {
  if (rubyVersion === 'default') {
    if (fs.existsSync('.ruby-version')) {
      rubyVersion = '.ruby-version'
    } else if (fs.existsSync('.tool-versions')) {
      rubyVersion = '.tool-versions'
    } else {
      throw new Error('input ruby-version needs to be specified if no .ruby-version or .tool-versions file exists')
    }
  } else if (rubyVersion === 'system') {
    rubyVersion = ''
    await exec.exec('ruby', ['-e', 'print "#{RUBY_ENGINE}-#{RUBY_VERSION}"'], {
      silent: true,
      listeners: {
        stdout: (data) => (rubyVersion += data.toString())
      }
    })
    if (!rubyVersion.includes('-')) {
      throw new Error('Could not determine system Ruby engine and version')
    }
  }

  if (rubyVersion === '.ruby-version') { // Read from .ruby-version
    rubyVersion = fs.readFileSync('.ruby-version', 'utf8').trim()
    console.log(`Using ${rubyVersion} as input from file .ruby-version`)
  } else if (rubyVersion === '.tool-versions') { // Read from .tool-versions
    const toolVersions = fs.readFileSync('.tool-versions', 'utf8').trim()
    const rubyLine = toolVersions.split(/\r?\n/).filter(e => /^ruby\s/.test(e))[0]
    rubyVersion = rubyLine.match(/^ruby\s+(.+)$/)[1]
    console.log(`Using ${rubyVersion} as input from file .tool-versions`)
  }

  let engine, version
  if (/^(\d+)/.test(rubyVersion) || common.isHeadVersion(rubyVersion)) { // X.Y.Z => ruby-X.Y.Z
    engine = 'ruby'
    version = rubyVersion
  } else if (!rubyVersion.includes('-')) { // myruby -> myruby-stableVersion
    engine = rubyVersion
    version = '' // Let the logic in validateRubyEngineAndVersion() find the version
  } else { // engine-X.Y.Z
    [engine, version] = common.partition(rubyVersion, '-')
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
    // Try to match stable versions first, so an empty version (engine-only) matches the latest stable version
    let found = latestToFirstVersion.find(v => common.isStableVersion(engine, v) && v.startsWith(parsedVersion))
    if (!found) {
      // Exclude head versions, they must be exact matches
      found = latestToFirstVersion.find(v => !common.isHeadVersion(v) && v.startsWith(parsedVersion))
    }

    if (found) {
      version = found
    } else {
      throw new Error(`Unknown version ${parsedVersion} for ${engine} on ${platform}
        available versions for ${engine} on ${platform}: ${engineVersions.join(', ')}
        Make sure you use the latest version of the action with - uses: ruby/setup-ruby@v1`)
    }
  }

  return version
}

function createGemRC(engine, version) {
  const gemrc = path.join(os.homedir(), '.gemrc')
  if (!fs.existsSync(gemrc)) {
    if (engine === 'ruby' && common.floatVersion(version) < 2.0) {
      fs.writeFileSync(gemrc, `install: --no-rdoc --no-ri${os.EOL}update: --no-rdoc --no-ri${os.EOL}`)
    } else {
      fs.writeFileSync(gemrc, `gem: --no-document${os.EOL}`)
    }
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

async function getSystemRubyPrefix() {
  let rubyPrefix = ''
  await exec.exec('ruby', ['-rrbconfig', '-e', 'print RbConfig::CONFIG["prefix"]'], {
    silent: true,
    listeners: {
      stdout: (data) => (rubyPrefix += data.toString())
    }
  })
  if (!rubyPrefix) {
    throw new Error('Could not determine system Ruby prefix')
  }
  return rubyPrefix
}

if (__filename.endsWith('index.js')) { run() }
