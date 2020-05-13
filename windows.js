// Most of this logic is from
// https://github.com/MSP-Greg/actions-ruby/blob/master/lib/main.js

const fs = require('fs')
const path = require('path')
const cp = require('child_process')
const core = require('@actions/core')
const exec = require('@actions/exec')
const tc = require('@actions/tool-cache')
const common = require('./common')
const rubyInstallerVersions = require('./windows-versions').versions

// Extract to SSD, see https://github.com/ruby/setup-ruby/pull/14
const drive = (process.env['GITHUB_WORKSPACE'] || 'C')[0]

// needed for 2.2, 2.3, and mswin, cert file used by Git for Windows
const certFile = 'C:\\Program Files\\Git\\mingw64\\ssl\\cert.pem'

// standard MSYS2 location, found by 'devkit.rb'
const msys2 = 'C:\\msys64'
const msys2PathEntries = [`${msys2}\\mingw64\\bin`, `${msys2}\\usr\\bin`]

// location & path for old RubyInstaller DevKit (MSYS), Ruby 2.2 and 2.3
const msys = `${drive}:\\DevKit64`
const msysPathEntries = [`${msys}\\mingw\\x86_64-w64-mingw32\\bin`,
  `${msys}\\mingw\\bin`, `${msys}\\bin`]

export function getAvailableVersions(platform, engine) {
  if (engine === 'ruby') {
    return Object.keys(rubyInstallerVersions)
  } else {
    return undefined
  }
}

export async function install(platform, engine, version) {
  const url = rubyInstallerVersions[version]

  if (!url.endsWith('.7z')) {
    throw new Error(`URL should end in .7z: ${url}`)
  }
  const base = url.slice(url.lastIndexOf('/') + 1, url.length - '.7z'.length)

  const downloadPath = await common.measure('Downloading Ruby', async () => {
    console.log(url)
    return await tc.downloadTool(url)
  })

  await common.measure('Extracting Ruby', async () =>
    exec.exec('7z', ['x', downloadPath, `-xr!${base}\\share\\doc`, `-o${drive}:\\`], { silent: true }))
  const rubyPrefix = `${drive}:\\${base}`

  let toolchainPaths = (version === 'mswin') ?
    await setupMSWin() : await setupMingw(version)
  const newPathEntries = [`${rubyPrefix}\\bin`, ...toolchainPaths]

  return [rubyPrefix, newPathEntries]
}

// Remove when Actions Windows image contains MSYS2 install
async function symLinkToEmbeddedMSYS2() {
  const toolCacheVersions = tc.findAllVersions('Ruby')
  toolCacheVersions.sort()
  if (toolCacheVersions.length === 0) {
    throw new Error('Could not find MSYS2 in the toolcache')
  }
  const latestVersion = toolCacheVersions.slice(-1)[0]
  const hostedRuby = tc.find('Ruby', latestVersion)
  await common.measure('Linking MSYS2', async () =>
    exec.exec(`cmd /c mklink /D ${msys2} ${hostedRuby}\\msys64`))
}

async function setupMingw(version) {
  core.exportVariable('MAKE', 'make.exe')

  if (version.startsWith('2.2') || version.startsWith('2.3')) {
    core.exportVariable('SSL_CERT_FILE', certFile)
    await common.measure('Installing MSYS1', async () =>
      installMSYS(version))

    return msysPathEntries
  } else {
    // Remove when Actions Windows image contains MSYS2 install
    if (!fs.existsSync(msys2)) {
      await symLinkToEmbeddedMSYS2()
    }

    return msys2PathEntries
  }
}

// Ruby 2.2 and 2.3
async function installMSYS(version) {
  const url = 'https://dl.bintray.com/oneclick/rubyinstaller/DevKit-mingw64-64-4.7.2-20130224-1432-sfx.exe'
  const downloadPath = await tc.downloadTool(url)
  await exec.exec('7z', ['x', downloadPath, `-o${msys}`], { silent: true })

  // below are set in the old devkit.rb file ?
  core.exportVariable('RI_DEVKIT', msys)
  core.exportVariable('CC' , 'gcc')
  core.exportVariable('CXX', 'g++')
  core.exportVariable('CPP', 'cpp')
  core.info(`Installed RubyInstaller DevKit for Ruby ${version}`)
}

async function setupMSWin() {
  core.exportVariable('MAKE', 'nmake.exe')

  // All standard MSVC OpenSSL builds use C:\Program Files\Common Files\SSL
  const certsDir = 'C:\\Program Files\\Common Files\\SSL\\certs'
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir)
  }

  // cert.pem location is hard-coded by OpenSSL msvc builds
  const cert = 'C:\\Program Files\\Common Files\\SSL\\cert.pem'
  if (!fs.existsSync(cert)) {
    fs.copyFileSync(certFile, cert)
  }

  // Remove when Actions Windows image contains MSYS2 install
  if (!fs.existsSync(msys2)) {
    await symLinkToEmbeddedMSYS2()
  }

  const VCPathEntries = await common.measure('Setting up MSVC environment', async () =>
    addVCVARSEnv())

  return [...VCPathEntries, ...msys2PathEntries]
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
        newPathEntries = v.replace(process.env['Path'], '').split(path.delimiter)
      } else {
        core.exportVariable(k, v)
      }
    }
  }
  return newPathEntries
}
