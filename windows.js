// Most of this logic is from
// https://github.com/MSP-Greg/actions-ruby/blob/master/lib/main.js

const fs = require('fs')
const path = require('path')
const cp = require('child_process')
const core = require('@actions/core')
const exec = require('@actions/exec')
const io = require('@actions/io')
const tc = require('@actions/tool-cache')
const common = require('./common')
const rubyInstallerVersions = require('./windows-versions').versions

const drive = common.drive

const msys2BasePath = 'C:\\msys64'

// needed for 2.0-2.3, and mswin, cert file used by Git for Windows
const certFile = 'C:\\Program Files\\Git\\mingw64\\ssl\\cert.pem'

// location & path for old RubyInstaller DevKit (MSYS), Ruby 2.0-2.3
const msys = `${drive}:\\DevKit64`
const msysPathEntries = [`${msys}\\mingw\\x86_64-w64-mingw32\\bin`, `${msys}\\mingw\\bin`, `${msys}\\bin`]

const virtualEnv = common.getVirtualEnvironmentName()

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

  let rubyPrefix, inToolCache
  if (common.shouldUseToolCache(engine, version)) {
    inToolCache = tc.find('Ruby', version)
    if (inToolCache) {
      rubyPrefix = inToolCache
    } else {
      rubyPrefix = common.getToolCacheRubyPrefix(platform, version)
    }
  } else {
    rubyPrefix = `${drive}:\\${base}`
  }

  let toolchainPaths = (version === 'mswin') ? await setupMSWin() : await setupMingw(version)

  if (!inToolCache) {
    await downloadAndExtract(engine, version, url, base, rubyPrefix);
  }

  const winMSYS2Type = common.setupPath([`${rubyPrefix}\\bin`, ...toolchainPaths])

  // install msys2 tools for all Ruby versions, only install mingw or ucrt for Rubies >= 2.4

  if (!['windows-2019', 'windows-2016'].includes(virtualEnv)) {
    await installMSYS2Tools()
  }

  if ((( winMSYS2Type === 'ucrt64') || !['windows-2019', 'windows-2016'].includes(virtualEnv)) &&
    (common.floatVersion(version) >= 2.4)) {
    await installGCCTools(winMSYS2Type)
  }

  const ridk = `${rubyPrefix}\\bin\\ridk.cmd`
  if (fs.existsSync(ridk)) {
    await common.measure('Adding ridk env variables', async () => addRidkEnv(ridk))
  }

  return rubyPrefix
}

// Actions windows-2022 image does not contain any mingw or ucrt build tools.  Install tools for it,
// and also install ucrt tools on earlier versions, which have msys2 and mingw tools preinstalled.
async function installGCCTools(type) {
  const downloadPath = await common.measure(`Downloading ${type} build tools`, async () => {
    let url = `https://github.com/MSP-Greg/setup-msys2-gcc/releases/download/msys2-gcc-pkgs/${type}.7z`
    console.log(url)
    return await tc.downloadTool(url)
  })

  await common.measure(`Extracting  ${type} build tools`, async () =>
    // -aoa overwrite existing, -bd disable progress indicator
    exec.exec('7z', ['x', downloadPath, '-aoa', '-bd', `-o${msys2BasePath}`], { silent: true }))
}

// Actions windows-2022 image does not contain any MSYS2 build tools.  Install tools for it.
// A subset of the MSYS2 base-devel group
async function installMSYS2Tools() {
  const downloadPath = await common.measure(`Downloading msys2 build tools`, async () => {
    let url = `https://github.com/MSP-Greg/setup-msys2-gcc/releases/download/msys2-gcc-pkgs/msys2.7z`
    console.log(url)
    return await tc.downloadTool(url)
  })

  // need to remove all directories, since they may indicate old packages are installed,
  // otherwise, error of "error: duplicated database entry"
  fs.rmdirSync(`${msys2BasePath}\\var\\lib\\pacman\\local`, { recursive: true, force: true })

  await common.measure(`Extracting  msys2 build tools`, async () =>
    // -aoa overwrite existing, -bd disable progress indicator
    exec.exec('7z', ['x', downloadPath, '-aoa', '-bd', `-o${msys2BasePath}`], { silent: true }))
}

// Windows JRuby can install gems that require compile tools, only needed for
// windows-2022 image
export async function installJRubyTools() {
  await installMSYS2Tools()
  await installGCCTools('mingw64')
}

async function downloadAndExtract(engine, version, url, base, rubyPrefix) {
  const parentDir = path.dirname(rubyPrefix)

  const downloadPath = await common.measure('Downloading Ruby', async () => {
    console.log(url)
    return await tc.downloadTool(url)
  })

  await common.measure('Extracting  Ruby', async () =>
    exec.exec('7z', ['x', downloadPath, '-bd', `-xr!${base}\\share\\doc`, `-o${parentDir}`], { silent: true }))

  if (base !== path.basename(rubyPrefix)) {
    await io.mv(path.join(parentDir, base), rubyPrefix)
  }

  if (common.shouldUseToolCache(engine, version)) {
    common.createToolCacheCompleteFile(rubyPrefix)
  }
}

async function setupMingw(version) {
  core.exportVariable('MAKE', 'make.exe')

  // rename these to avoid confusion when Ruby is using OpenSSL 1.0.2
  // most current extconf files look for 1.1.x dll files first, which is the
  // version of the renamed files
  if (common.floatVersion(version) <= 2.4) { renameSystem32Dlls() }

  if (common.floatVersion(version) <= 2.3) {
    core.exportVariable('SSL_CERT_FILE', certFile)
    await common.measure('Installing MSYS', async () => installMSYS(version))
    return msysPathEntries
  } else {
    return []
  }
}

// Ruby 2.0, 2.1, 2.2 and 2.3
async function installMSYS(version) {
  const url = 'https://github.com/oneclick/rubyinstaller/releases/download/devkit-4.7.2/DevKit-mingw64-64-4.7.2-20130224-1432-sfx.exe'
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

  return await common.measure('Setting up MSVC environment', async () => addVCVARSEnv())
}

/* Sets MSVC environment for use in Actions
 *   allows steps to run without running vcvars*.bat, also for PowerShell
 *   adds a convenience VCVARS environment variable
 *   this assumes a single Visual Studio version being available in the Windows images */
export function addVCVARSEnv() {
  let vcVars = ''
  switch (virtualEnv) {
    case 'windows-2016':
      vcVars = '"C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Enterprise\\VC\\Auxiliary\\Build\\vcvars64.bat"'
      break
    case 'windows-2019':
      vcVars = '"C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Auxiliary\\Build\\vcvars64.bat"'
      break
    case 'windows-2022':
      vcVars = '"C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Auxiliary\\Build\\vcvars64.bat"'
      break
    default:
      throw new Error(`Unknown Windows Image: ${virtualEnv}`)
  }
  core.exportVariable('VCVARS', vcVars)

  let newEnv = new Map()
  let cmd = `cmd.exe /c "${vcVars} && set"`
  let newSet = cp.execSync(cmd).toString().trim().split(/\r?\n/)
  newSet = newSet.filter(line => /\S=\S/.test(line))
  newSet.forEach(s => {
    let [k,v] = common.partition(s, '=')
    newEnv.set(k,v)
  })

  let newPathEntries = undefined
  for (let [k, v] of newEnv) {
    if (process.env[k] !== v) {
      if (/^Path$/i.test(k)) {
        const newPathStr = v.replace(`${path.delimiter}${process.env['Path']}`, '')
        newPathEntries = newPathStr.split(path.delimiter)
      } else {
        core.exportVariable(k, v)
      }
    }
  }
  return newPathEntries
}

// ssl files cause issues with non RI2 Rubies (<2.4) and ruby/ruby's CI from
// build folder due to dll resolution
function renameSystem32Dlls() {
  const sys32 = 'C:\\Windows\\System32\\'
  const badFiles = ['libcrypto-1_1-x64.dll', 'libssl-1_1-x64.dll']
  badFiles.forEach( (bad) => {
    let fn = `${sys32}${bad}`
    if (fs.existsSync(fn)) { fs.renameSync(fn, `${fn}_`) }
  })
}

// Sets MSYS2 ENV variables set from running `ridk enable`
//
function addRidkEnv(ridk) {
  let newEnv = new Map()
  let cmd = `cmd.exe /c "${ridk} enable && set"`
  let newSet = cp.execSync(cmd).toString().trim().split(/\r?\n/)
  newSet = newSet.filter(line => /^\S+=\S+/.test(line))
  newSet.forEach(s => {
    let [k,v] = common.partition(s, '=')
    newEnv.set(k,v)
  })

  for (let [k, v] of newEnv) {
    if (process.env[k] !== v) {
      if (!/^Path$/i.test(k)) {
        console.log(`${k}=${v}`)
        core.exportVariable(k, v)
      }
    }
  }
}
