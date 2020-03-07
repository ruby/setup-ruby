// Most of this logic is from
// https://github.com/MSP-Greg/actions-ruby/blob/master/lib/main.js

const fs = require('fs')
const cp = require('child_process')
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

  // we use certs and embedded MSYS2 from hostedRuby
  const hostedRuby = latestHostedRuby()

  let toolchainPaths = (version === 'mswin') ?
    await setupMSWin(hostedRuby) : await setupMingw(hostedRuby, version)
  const newPathEntries = [`${rubyPrefix}\\bin`, ...toolchainPaths]

  // Install Bundler if needed
  if (!fs.existsSync(`${rubyPrefix}\\bin\\bundle.cmd`)) {
    await exec.exec(`${rubyPrefix}\\bin\\gem install bundler -v "~> 1" --no-document`)
  }

  return [rubyPrefix, newPathEntries]
}

function latestHostedRuby() {
  const toolCacheVersions = tc.findAllVersions('Ruby')
  toolCacheVersions.sort()
  if (toolCacheVersions.length === 0) {
    throw new Error('Could not find MSYS2 in the toolcache')
  }
  const latestVersion = toolCacheVersions.slice(-1)[0]
  return tc.find('Ruby', latestVersion)
}

async function setupMingw(hostedRuby, version) {
  if (version.startsWith('2.2') || version.startsWith('2.3')) {
    core.exportVariable('SSL_CERT_FILE', `${hostedRuby}\\ssl\\cert.pem`)
  }

  // Link to embedded MSYS2 in hostedRuby
  const msys2 = 'C:\\msys64'
  if (!fs.existsSync(msys2)) {
    const hostedMSYS2 = `${hostedRuby}\\msys64`
    await exec.exec(`cmd /c mklink /D ${msys2} ${hostedMSYS2}`)
  }

  return [`${msys2}\\mingw64\\bin`, `${msys2}\\usr\\bin`]
}

async function setupMSWin(hostedRuby) {
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

  return addVCVARSEnv()
}

/* Sets MSVC environment for use in Actions
 *   allows steps to run without running vcvars*.bat, also for PowerShell
 *   adds a convenience VCVARS environment variable
 *   this assumes a single Visual Studio version being available in the windows-latest image */
export function addVCVARSEnv() {
  const vcVars = '"C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Auxiliary\\Build\\vcvars64.bat"'
  core.exportVariable('VCVARS', vcVars)

  let newEnv = new Map()
  let cmd = `cmd.exe /c "${vcVars} && set"`
  let newSet = cp.execSync(cmd).toString().trim().split(/\r?\n/)
  newSet = newSet.filter(line => line.match(/\S=\S/))
  newSet.forEach(s => {
    let [k,v] = s.split('=', 2)
    newEnv.set(k,v)
  })

  let newPathEntries = undefined
  for (let [k, v] of newEnv) {
    if (process.env[k] !== v) {
      if (k === 'Path') {
        newPathEntries = v.replace(process.env['Path'], '').split(';')
      } else {
        core.exportVariable(k, v)
      }
    }
  }
  return newPathEntries
}
