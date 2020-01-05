// Most of this logic is from
// https://github.com/MSP-Greg/actions-ruby/blob/master/lib/main.js

const core = require('@actions/core')
const exec = require('@actions/exec')
const tc = require('@actions/tool-cache')

const releasesURL = 'https://github.com/oneclick/rubyinstaller2/releases'

export async function downloadExtractAndSetPATH(ruby) {
  const version = ruby.split('-', 2)[1]
  if (!ruby.startsWith('ruby-') || version.startsWith('2.3')) {
    throw new Error(`Only ruby >= 2.4 is supported on Windows currently (input: ${ruby})`)
  }
  const tag = `RubyInstaller-${version}-1`
  const base = `${tag.toLowerCase()}-x64`

  const url = `${releasesURL}/download/${tag}/${base}.7z`
  console.log(url)

  const downloadPath = await tc.downloadTool(url)
  await exec.exec(`7z x ${downloadPath} -xr!${base}\\share\\doc -oC:\\`)
  const rubyPrefix = `C:\\${base}`

  const msys2 = await linkMSYS2()
  const newPath = setupPath(msys2, rubyPrefix)
  core.exportVariable('PATH', newPath)

  return rubyPrefix
}

async function linkMSYS2() {
  const toolCacheVersions = tc.findAllVersions('Ruby')
  toolCacheVersions.sort()
  const latestVersion = toolCacheVersions.slice(-1)[0]
  const latestHostedRuby = tc.find('Ruby', latestVersion)

  const hostedMSYS2 = `${latestHostedRuby}\\msys64`
  const msys2 = 'C:\\msys64'
  await exec.exec(`cmd /c mklink /D ${msys2} ${hostedMSYS2}`)
  return msys2
}

function setupPath(msys2, rubyPrefix) {
  let path = process.env['PATH'].split(';')

  // Remove conflicting dev tools from PATH
  path = path.filter(e => !e.match(/\b(Chocolatey|CMake|mingw64|OpenSSL|Strawberry)\b/))

  // Remove default Ruby in PATH
  path = path.filter(e => !e.match(/\bRuby\b/))

  // Add MSYS2 in PATH
  path.unshift(`${msys2}\\mingw64`, `${msys2}\\usr`)

  // Add the downloaded Ruby in PATH
  path.unshift(`${rubyPrefix}\\bin`)

  return path.join(';')
}
