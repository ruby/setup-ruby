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
  'token': '',
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
  common.inputs.token = inputs['token']

  process.chdir(inputs['working-directory'])

  const platform = common.getOSNameVersion()
  const [engine, parsedVersion] = parseRubyEngineAndVersion(inputs['ruby-version'])

  let installer
  if (platform.startsWith('windows-') && engine === 'ruby' && !common.isSelfHostedRunner()) {
    installer = require('./windows')
  } else {
    installer = require('./ruby-builder')
  }

  let version
  if (common.isSelfHostedRunner()) {
    // The list of available Rubies in the hostedtoolcache is unrelated to getAvailableVersions()
    version = parsedVersion
  } else {
    const engineVersions = installer.getAvailableVersions(platform, engine)
    version = validateRubyEngineAndVersion(platform, engineVersions, engine, parsedVersion)
  }

  createGemRC(engine, version)
  envPreInstall()

  const rubyPrefix = await installer.install(platform, engine, version)

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
      bundler.installBundler(inputs['bundler'], rubygemsInputSet, lockFile, platform, rubyPrefix, engine, version))
  }

  if (inputs['bundler-cache'] === 'true') {
    await common.time('bundle install', async () =>
      bundler.bundleInstall(gemfile, lockFile, platform, engine, version, bundlerVersion, inputs['cache-version']))
  }

  core.setOutput('ruby-prefix', rubyPrefix)
}

function parseRubyEngineAndVersion(rubyVersion) {
  if (rubyVersion === 'default') {
    if (fs.existsSync('.ruby-version')) {
      rubyVersion = '.ruby-version'
    } else if (fs.existsSync('.tool-versions')) {
      rubyVersion = '.tool-versions'
    } else if (fs.existsSync('mise.toml')) {
      rubyVersion = 'mise.toml'
    } else {
      throw new Error('input ruby-version needs to be specified if no .ruby-version or .tool-versions file exists')
    }
  }

  if (rubyVersion === '.ruby-version') { // Read from .ruby-version
    rubyVersion = fs.readFileSync('.ruby-version', 'utf8').trim()
    console.log(`Using ${rubyVersion} as input from file .ruby-version`)
  } else if (rubyVersion === '.tool-versions') { // Read from .tool-versions
    const toolVersions = fs.readFileSync('.tool-versions', 'utf8').trim()
    const regexp = /^ruby\s+(\S+)/
    const rubyLine = toolVersions.split(/\r?\n/).filter(e => regexp.test(e))[0]
    rubyVersion = rubyLine.match(regexp)[1]
    console.log(`Using ${rubyVersion} as input from file .tool-versions`)
  } else if (rubyVersion === 'mise.toml') { // Read from mise.toml
    const toolVersions = fs.readFileSync('mise.toml', 'utf8').trim()
    const regexp = /^ruby\s*=\s*['"](.+)['"]$/
    const rubyLine = toolVersions.split(/\r?\n/).filter(e => regexp.test(e))[0]
    rubyVersion = rubyLine.match(regexp)[1]
    console.log(`Using ${rubyVersion} as input from file mise.toml`)
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
        Available versions for ${engine} on ${platform}: ${engineVersions.join(', ')}
        Make sure you use the latest version of the action with - uses: ruby/setup-ruby@v1`)
    }
  }

  // Well known version-platform combinations which do not work:
  if (engine === 'ruby' && platform.startsWith('macos') && os.arch() === 'arm64' && common.floatVersion(version) < 2.6) {
    throw new Error(`CRuby < 2.6 does not support macos-arm64.
        Either use a newer Ruby version or use a macOS image running on amd64, e.g., macos-15-intel.
        Note that GitHub changed the meaning of macos-latest from macos-12 (amd64) to macos-14 (arm64):
        https://github.blog/changelog/2024-04-01-macos-14-sonoma-is-generally-available-and-the-latest-macos-runner-image/

        If you are using a matrix of Ruby versions, a good solution is to run only < 2.6 on amd64, like so:
        matrix:
          ruby: ['2.4', '2.5', '2.6', '2.7', '3.0', '3.1', '3.2', '3.3']
          os: [ ubuntu-latest, macos-latest ]
          # CRuby < 2.6 does not support macos-arm64, so test those on amd64 instead
          exclude:
          - { os: macos-latest, ruby: '2.4' }
          - { os: macos-latest, ruby: '2.5' }
          include:
          - { os: macos-15-intel, ruby: '2.4' }
          - { os: macos-15-intel, ruby: '2.5' }

        But of course you should consider dropping support for these long-EOL Rubies, which cannot even be built on recent macOS machines.`)
  } else if (engine === 'truffleruby' && platform.startsWith('windows')) {
    throw new Error('TruffleRuby does not currently support Windows.')
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

if (__filename.endsWith('index.js')) { run() }
