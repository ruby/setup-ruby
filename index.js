const core = require('@actions/core')
const io = require('@actions/io')
const tc = require('@actions/tool-cache')
const os = require('os')
const fs = require('fs')

async function run() {
  try {
    const rubyVersion = core.getInput('ruby-version')

    let ruby = rubyVersion
    if (!ruby.includes('-')) {
      ruby = 'ruby-' + ruby;
    }

    const rubiesDir = `${process.env.HOME}/.rubies`
    await io.mkdirP(rubiesDir)

    const platform = getVirtualEnvironmentName()
    const url = `https://github.com/eregon/ruby-install-builder/releases/download/builds/${ruby}-${platform}.tar.gz`
    console.log(url)

    const downloadPath = await tc.downloadTool(url)
    await tc.extractTar(downloadPath, rubiesDir)

    const rubyPrefix = `${rubiesDir}/${ruby}`
    core.addPath(`${rubyPrefix}/bin`)
    core.setOutput('ruby-prefix', rubyPrefix)
  } catch (error) {
    core.setFailed(error.message)
  }
}

function getVirtualEnvironmentName() {
  const platform = os.platform()
  if (platform == 'linux') {
    return `ubuntu-${findUbuntuVersion()}`
  } else if (platform == 'darwin') {
    return 'macos-latest'
  } else if (platform == 'win32') {
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

run()
