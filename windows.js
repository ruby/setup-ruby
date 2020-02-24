// Most of this logic is from
// https://github.com/MSP-Greg/actions-ruby/blob/master/lib/main.js

const fs = require('fs')
const core = require('@actions/core')
const exec = require('@actions/exec')
const tc = require('@actions/tool-cache')
const rubyInstallerVersions = require('./windows-versions').versions

export function getAvailableVersions(platform, engine) {
  if (engine === 'ruby') {
    return Object.keys(rubyInstallerVersions)
  } else {
    return undefined
  }
}

export async function install(platform, ruby) {
  const version = ruby.split('-', 2)[1]
  const url = rubyInstallerVersions[version]
  console.log(url)

  if (!url.endsWith('.7z')) {
    throw new Error('URL should end in .7z')
  }
  const base = url.slice(url.lastIndexOf('/') + 1, url.length - '.7z'.length)

  // Extract to SSD, see https://github.com/ruby/setup-ruby/pull/14
  const drive = (process.env['GITHUB_WORKSPACE'] || 'C')[0]

  const downloadPath = await tc.downloadTool(url)
  await exec.exec('7z', ['x', downloadPath, `-xr!${base}\\share\\doc`, `-o${drive}:\\`], { silent: true })
  const rubyPrefix = `${drive}:\\${base}`

  const [hostedRuby, msys2] = await linkMSYS2()
  setupPath((ruby === 'ruby-mswin' ? null : msys2), rubyPrefix)

  if (version.startsWith('2.2') || version.startsWith('2.3')) {
    core.exportVariable('SSL_CERT_FILE', `${hostedRuby}\\ssl\\cert.pem`)
  } else if (version === 'mswin') {
    setupMSWin(hostedRuby)
  }

  if (!fs.existsSync(`${rubyPrefix}\\bin\\bundle.cmd`)) {
    await exec.exec(`${rubyPrefix}\\bin\\gem install bundler -v "~> 1" --no-document`)
  }

  return rubyPrefix
}

function setupMSWin(hostedRuby) {
  // All standard MSVC OpenSSL builds use C:\Program Files\Common Files\SSL
  const certsDir = 'C:\\Program Files\\Common Files\\SSL\\certs'
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir)
  }

  // Copy cert.pem from hosted Ruby
  const cert = 'C:\\Program Files\\Common Files\\SSL\\cert.pem'
  if (!fs.existsSync(cert)) {
    const hostedCert = `${hostedRuby}\\ssl\\cert.pem`
    fs.copyFileSync(hostedCert, cert)
  }

  // add convenience VCVARS env variable for msvc use
  // depends on single Visual Studio version being available in Actions image
  core.exportVariable('VCVARS', '"C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Auxiliary\\Build\\vcvars64.bat"')
}

async function linkMSYS2() {
  const toolCacheVersions = tc.findAllVersions('Ruby')
  toolCacheVersions.sort()
  if (toolCacheVersions.length === 0) {
    throw new Error('Could not find MSYS2 in the toolcache')
  }
  const latestVersion = toolCacheVersions.slice(-1)[0]
  const latestHostedRuby = tc.find('Ruby', latestVersion)

  const hostedMSYS2 = `${latestHostedRuby}\\msys64`
  const msys2 = 'C:\\msys64'
  if (!fs.existsSync(msys2)) {
    await exec.exec(`cmd /c mklink /D ${msys2} ${hostedMSYS2}`)
  }
  return [latestHostedRuby, msys2]
}

export function setupPath(msys2, rubyPrefix) {
  const originalPath = process.env['PATH'].split(';')
  let path = originalPath.slice()

  // Remove default Ruby in PATH
  path = path.filter(e => !e.match(/\bRuby\b/))

  if (msys2) {
    // Add MSYS2 in PATH
    path.unshift(`${msys2}\\mingw64\\bin`, `${msys2}\\usr\\bin`)
  }

  // Add the downloaded Ruby in PATH
  path.unshift(`${rubyPrefix}\\bin`)

  console.log("Entries removed from PATH to avoid conflicts with Ruby:")
  for (const entry of originalPath) {
    if (!path.includes(entry)) {
      console.log(entry)
    }
  }

  const newPath = path.join(';')
  core.exportVariable('PATH', newPath)
}
