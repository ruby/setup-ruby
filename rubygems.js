const path = require('path')
const exec = require('@actions/exec')
const semver = require('semver')

export async function rubygemsUpdate(rubygemsVersionInput, rubyPrefix) {
  const gem = path.join(rubyPrefix, 'bin', 'gem')

  let gemVersion = ''

  await exec.exec(gem, ['--version'], {
    listeners: {
      stdout: (data) => (gemVersion += data.toString()),
    }
  });

  gemVersion = semver.coerce(gemVersion.trim())
  console.log(`Default RubyGems version is ${gemVersion}`)

  if (rubygemsVersionInput === 'latest') {
    console.log('Updating RubyGems to latest version')
    await exec.exec(gem, ['update', '--system'])
  } else if (semver.gt(rubygemsVersionInput, gemVersion)) {
    console.log(`Updating RubyGems to ${rubygemsVersionInput}`)
    await exec.exec(gem, ['update', '--system', rubygemsVersionInput])
  } else {
    console.log(`Skipping RubyGems update because the given version (${rubygemsVersionInput}) is not newer than the default version (${gemVersion})`)
  }

  return true
}
