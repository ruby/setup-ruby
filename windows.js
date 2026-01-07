// 7z arguments
//   -aoa overwrite existing, -bd disable progress indicator

const fs = require('fs')
const os = require('os')
const path = require('path')
const cp = require('child_process')
const core = require('@actions/core')
const exec = require('@actions/exec')
const common = require('./common')
const rubyInstallerVersions = require('./windows-versions.json')
const toolchainVersions = require('./windows-toolchain-versions.json')

export function getAvailableVersions(_platform, engine) {
  if (engine === 'ruby') {
    return Object.keys(rubyInstallerVersions).filter(version => os.arch() in rubyInstallerVersions[version])
  } else {
    return undefined
  }
}

export async function install(platform, engine, version) {
  const url = rubyInstallerVersions[version][os.arch()]

  if (!url.endsWith('.7z')) {
    throw new Error(`URL should end in .7z: ${url}`)
  }
  const base = path.posix.basename(url, '.7z')

  let rubyPrefix, inToolCache
  if (common.shouldUseToolCache(engine, version)) {
    inToolCache = common.toolCacheFind(engine, version)
    if (inToolCache) {
      rubyPrefix = inToolCache
    } else {
      rubyPrefix = common.getToolCacheRubyPrefix(platform, engine, version)
    }
  } else {
    rubyPrefix = `${common.drive}:\\${base}`
  }

  if (!inToolCache) {
    await downloadAndExtract(engine, version, url, base, rubyPrefix);
  }

  const paths = [`${rubyPrefix}\\bin`]
  const windowsToolchain = core.getInput('windows-toolchain')
  if (windowsToolchain === 'none') {
    common.setupPath(paths)
    return rubyPrefix
  }

  const toolchainUrl = toolchainVersions[version][os.arch()]

  // Examples:
  // - DevKit-mingw64-64-4.7.2-20130224-1432-sfx.exe
  // - msys2-clangarm64.7z
  // - vcpkg-x64-windows.7z
  const toolchainName = path.posix.basename(toolchainUrl).split('-')[0].toLowerCase()

  if (toolchainName === 'msys2') {
    paths.push(...await installMSYS2(toolchainUrl, rubyPrefix))
  } else {
    if (toolchainName === 'vcpkg') {
      paths.push(...await installVCPKG(toolchainUrl))
    } else if (toolchainName === 'devkit') {
      paths.push(...await installMSYS1(toolchainUrl))
    } else {
      throw new Error(`Unknown toolchain type: ${toolchainUrl}`)
    }

    // Install msys2 for other rubies to provide better command line tools
    paths.push(...await installMSYS2(toolchainVersions['head'][os.arch()]))
  }

  common.setupPath(paths)
  return rubyPrefix
}

async function downloadAndExtract(engine, version, url, base, rubyPrefix) {
  const downloadPath = await common.measure('Downloading Ruby', async () => {
    console.log(url)
    return await common.download(url)
  })

  const extractPath = process.env.RUNNER_TEMP
  await common.measure('Extracting  Ruby', async () =>
    // -xr extract but exclude share\doc files
    exec.exec('7z', ['x', downloadPath, '-bd', `-xr!${base}\\share\\doc`, `-o${extractPath}`], { silent: true }))

  const parentDir = path.dirname(rubyPrefix)
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true })
  }

  const extractedPath = path.join(extractPath, base)
  if (extractedPath[0] === rubyPrefix[0]) {
    fs.renameSync(extractedPath, rubyPrefix)
  } else {
    fs.symlinkSync(extractedPath, rubyPrefix, 'junction')
  }

  if (common.shouldUseToolCache(engine, version)) {
    common.createToolCacheCompleteFile(rubyPrefix)
  }
}

export async function installJRubyTools() {
  return await installMSYS2(toolchainVersions['head'][os.arch()])
}

async function installMSYS2(url, rubyPrefix = process.env.RUNNER_TEMP) {
  const downloadPath = await common.measure('Downloading msys2 build tools', async () => {
    console.log(url)
    return await common.download(url)
  })

  const extractPath = path.join(process.env.RUNNER_TEMP, 'msys64')
  await common.measure('Extracting  msys2 build tools', async () =>
    exec.exec('7z', ['x', downloadPath, '-aoa', '-bd', `-o${extractPath}`], { silent: true }))

  // https://github.com/oneclick/rubyinstaller2/blob/HEAD/lib/ruby_installer/build/msys2_installation.rb
  //
  // ri2 searches for msys64 in the following order:
  // - ENV["MSYS2_PATH"]
  // - File.join(RbConfig::TOPDIR, "msys64")
  // - File.join(File.dirname(RbConfig::TOPDIR), "msys64")
  // - "C:\msys64"
  // - ...
  //
  // The first option ENV["MSYS2_PATH"] is only supported in ruby >=3.0.7.
  // Therefore we use the second option to avoid conflict with existing "C:\msys64"
  const msys2Path = path.join(rubyPrefix, 'msys64')
  if (extractPath !== msys2Path) {
    fs.symlinkSync(extractPath, msys2Path, 'junction')
  }

  const ridk = `${rubyPrefix}\\bin\\ridk.cmd`
  if (fs.existsSync(ridk)) {
    await common.measure('Setting up ridk environment', async () => exportCommandEnv(`set "MAKE=make" && "${ridk}" enable`))
  }

  // Examples:
  // - msys2-clangarm64.7z
  // - msys2-ucrt64-gcc@14.7z
  // - msys2-mingw64-gcc@14-openssl@1.1.7z
  const msys2Type = path.posix.basename(url).split(/[-.]/)[1]
  return [`${msys2Path}\\${msys2Type}\\bin`, `${msys2Path}\\usr\\bin`]
}

async function installMSYS1(url) {
  const certFile = [
    'C:\\Program Files\\Git\\mingw64\\etc\\ssl\\cert.pem',
    'C:\\Program Files\\Git\\mingw64\\ssl\\cert.pem',
  ].find(file => fs.existsSync(file))
  if (certFile === undefined) {
    throw new Error("Cannot find Git's cert file")
  }

  const downloadPath = await common.measure('Downloading msys1 build tools', async () => {
    console.log(url)
    return await common.download(url)
  })

  const msys1Path = `${common.drive}:\\DevKit64`
  await common.measure('Extracting  msys1 build tools', async () =>
    exec.exec('7z', ['x', downloadPath, '-aoa', '-bd', `-o${msys1Path}`], { silent: true }))

  await common.measure('Setting up DevKit environment', async () => {
    // ssl dlls cause issues with msys1 Rubies
    const sys32 = 'C:\\Windows\\System32\\'
    const badFiles = [`${sys32}libcrypto-1_1-x64.dll`, `${sys32}libssl-1_1-x64.dll`]
    const existing = badFiles.filter((dll) => fs.existsSync(dll))
    if (existing.length > 0) {
      core.warning(`Renaming ${existing.join(' and ')} to avoid dll resolution conflicts on Ruby < 2.4`)
      existing.forEach(dll => fs.renameSync(dll, `${dll}_`))
    }

    exportEnv({
      CC: 'gcc',
      CPP: 'cpp',
      CXX: 'g++',
      MAKE: 'make',
      RI_DEVKIT: msys1Path,
      SSL_CERT_FILE: certFile
    })
  })

  return [`${msys1Path}\\mingw\\x86_64-w64-mingw32\\bin`, `${msys1Path}\\mingw\\bin`, `${msys1Path}\\bin`]
}

/* Sets MSVC environment for use in Actions
 *   allows steps to run without running vcvars*.bat, also for PowerShell
 *   this assumes a single Visual Studio version being available in the Windows images */
async function installVCPKG(url) {
  const downloadPath = await common.measure('Downloading mswin vcpkg packages', async () => {
    console.log(url)
    return await common.download(url)
  })

  const extractPath = process.env.VCPKG_INSTALLATION_ROOT
  await common.measure('Extracting  mswin vcpkg packages', async () =>
    exec.exec('7z', ['x', downloadPath, '-aoa', '-bd', `-o${extractPath}`], { silent: true }))

  return await common.measure('Setting up MSVC environment', async () => {
    const cmd = 'vswhere -latest -property installationPath'
    const vcVarsBat = os.arch() === 'arm64' ? 'vcvarsarm64.bat' : 'vcvars64.bat'
    const vcVars = `${cp.execSync(cmd).toString().trim()}\\VC\\Auxiliary\\Build\\${vcVarsBat}`

    if (!fs.existsSync(vcVars)) {
      throw new Error(`Missing vcVars file: ${vcVars}`)
    }

    return exportCommandEnv(`set "MAKE=nmake" && "${vcVars}"`)
  })
}

// Run a cmd command, export its environment, and return new paths
function exportCommandEnv(command) {
  const cmd = `cmd.exe /s /c "${command} >NUL && "${process.execPath}" -e console.log(JSON.stringify(process.env))"`
  const env = JSON.parse(cp.execSync(cmd).toString())

  const paths = env.Path.replace(`${path.delimiter}${process.env.Path}`, '').split(path.delimiter)
  delete env.Path

  exportEnv(env)
  return paths
}

function exportEnv(env) {
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] !== v) {
      console.log(`${k}=${v}`)
      core.exportVariable(k, v)
    }
  }
}
