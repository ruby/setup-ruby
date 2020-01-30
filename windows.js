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

  // Extract to SSD, see https://github.com/eregon/use-ruby-action/pull/14
  const drive = (process.env['GITHUB_WORKSPACE'] || 'C')[0]

  const downloadPath = await tc.downloadTool(url)
  await exec.exec(`7z x ${downloadPath} -xr!${base}\\share\\doc -o${drive}:\\`)
  const rubyPrefix = `${drive}:\\${base}`

  const [hostedRuby, msys2] = await linkMSYS2()
  const newPath = setupPath(msys2, rubyPrefix)
  core.exportVariable('PATH', newPath)

  if (version.startsWith('2.3')) {
    core.exportVariable('SSL_CERT_FILE', `${hostedRuby}\\ssl\\cert.pem`)
  }

  if (!fs.existsSync(`${rubyPrefix}\\bin\\bundle.cmd`)) {
    await exec.exec(`${rubyPrefix}\\bin\\gem install bundler -v "~> 1" --no-document`)
  }

  return rubyPrefix
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
  await exec.exec(`cmd /c mklink /D ${msys2} ${hostedMSYS2}`)
  return [latestHostedRuby, msys2]
}

function setupPath(msys2, rubyPrefix) {
  let path = process.env['PATH'].split(';')

  // Remove conflicting dev tools from PATH
  path = path.filter(e => !e.match(/\b(Chocolatey|CMake|mingw64|OpenSSL|Strawberry)\b/))

  // Remove default Ruby in PATH
  path = path.filter(e => !e.match(/\bRuby\b/))

  // Add MSYS2 in PATH
  path.unshift(`${msys2}\\mingw64\\bin`, `${msys2}\\usr\\bin`)

  // Add the downloaded Ruby in PATH
  path.unshift(`${rubyPrefix}\\bin`)

  return path.join(';')
}
