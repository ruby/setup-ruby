const os = require('os')
const fs = require('fs')
const path = require('path')
const core = require('@actions/core')
const exec = require('@actions/exec')

export async function run() {
  try {
    const platform = getVirtualEnvironmentName()
    const [engine, version] = parseRubyEngineAndVersion(core.getInput('ruby-version'))

    let installer
    if (platform === 'windows-latest' && engine !== 'jruby') {
      installer = require('./windows')
    } else {
      installer = require('./ruby-builder')
    }

    const engineVersions = installer.getAvailableVersions(platform, engine)
    const ruby = validateRubyEngineAndVersion(platform, engineVersions, engine, version)

    createGemRC()

    const [rubyPrefix, newPathEntries] = await installer.install(platform, ruby)

    setupPath(ruby, newPathEntries)

    await installBundler(platform, rubyPrefix, engine, version)

    core.setOutput('ruby-prefix', rubyPrefix)
  } catch (error) {
    core.setFailed(error.message)
  }
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
  if (rubyVersion.match(/^(\d+|head|mingw|mswin)/)) { // X.Y.Z => ruby-X.Y.Z
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

function validateRubyEngineAndVersion(platform, engineVersions, engine, version) {
  if (!engineVersions) {
    throw new Error(`Unknown engine ${engine} on ${platform}`)
  }

  if (!engineVersions.includes(version)) {
    const latestToFirstVersion = engineVersions.slice().reverse()
    const found = latestToFirstVersion.find(v => v !== 'head' && v.startsWith(version))
    if (found) {
      version = found
    } else {
      throw new Error(`Unknown version ${version} for ${engine} on ${platform}
        available versions for ${engine} on ${platform}: ${engineVersions.join(', ')}
        File an issue at https://github.com/ruby/setup-ruby/issues if would like support for a new version`)
    }
  }

  return engine + '-' + version
}

function createGemRC() {
  const gemrc = path.join(os.homedir(), '.gemrc')
  if (!fs.existsSync(gemrc)) {
    fs.writeFileSync(gemrc, `gem: --no-document${os.EOL}`)
  }
}

function setupPath(ruby, newPathEntries) {
    const originalPath = process.env['PATH'].split(path.delimiter)
    let cleanPath = originalPath.filter(entry => !/\bruby\b/i.test(entry))

    if (cleanPath.length !== originalPath.length) {
        console.log('Entries removed from PATH to avoid conflicts with Ruby:')
        for (const entry of originalPath) {
            if (!cleanPath.includes(entry)) {
                console.log(`  ${entry}`)
            }
        }
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

async function installBundler(platform, rubyPrefix, engine, rubyVersion) {
  var bundlerVersion = core.getInput('bundler')
  if (bundlerVersion === 'none') {
    return
  }

  if (bundlerVersion === 'default' || bundlerVersion === 'Gemfile.lock') {
    bundlerVersion = readBundledWithFromGemfileLock()
    if (!bundlerVersion) {
      bundlerVersion = 'latest'
    }
  }

  if (bundlerVersion === 'latest') {
    bundlerVersion = '2'
  }

  if (rubyVersion.startsWith('2.2')) {
    console.log('Bundler 2 requires Ruby 2.3+, using Bundler 1 on Ruby 2.2')
    bundlerVersion = '1'
  } else if (/^\d+/.test(bundlerVersion)) {
    // OK
  } else {
    throw new Error(`Cannot parse bundler input: ${bundlerVersion}`)
  }

  if (engine === 'rubinius') {
    console.log(`Rubinius only supports the version of Bundler shipped with it`)
  } else if (engine === 'ruby' && isHeadVersion(rubyVersion) && bundlerVersion === '2') {
    console.log(`Using the Bundler version shipped with ${engine}-${rubyVersion}`)
  } else if (engine === 'truffleruby' && bundlerVersion === '1') {
    console.log(`Using the Bundler version shipped with ${engine}`)
  } else {
    const gem = path.join(rubyPrefix, 'bin', 'gem')
    await exec.exec(gem, ['install', 'bundler', '-v', `~> ${bundlerVersion}`, '--no-document'])
  }
}

function isHeadVersion(rubyVersion) {
  return rubyVersion === 'head' || rubyVersion === 'mingw' || rubyVersion === 'mswin'
}

function getVirtualEnvironmentName() {
  const platform = os.platform()
  if (platform === 'linux') {
    return `ubuntu-${findUbuntuVersion()}`
  } else if (platform === 'darwin') {
    return 'macos-latest'
  } else if (platform === 'win32') {
    return 'windows-latest'
  } else {
    throw new Error(`Unknown platform ${platform}`)
  }
}

function findUbuntuVersion() {
  const lsb_release = fs.readFileSync('/etc/lsb-release', 'utf8')
  const match = lsb_release.match(/^DISTRIB_RELEASE=(\d+\.\d+)$/m)
  if (match) {
    return match[1]
  } else {
    throw new Error('Could not find Ubuntu version')
  }
}

if (__filename.endsWith('index.js')) { run() }
