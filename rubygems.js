const common = require('./common')
const path = require('path')
const exec = require('@actions/exec')
const semver = require('semver')

export async function rubygemsUpdate(rubygemsVersionInput, rubyPrefix, platform, engine, version) {
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
    await rubygemsLatest(gem, platform, engine, version)
  } else if (semver.gt(rubygemsVersionInput, gemVersion)) {
    console.log(`Updating RubyGems to ${rubygemsVersionInput}`)
    await exec.exec(gem, ['update', '--system', rubygemsVersionInput])
  } else {
    console.log(`Skipping RubyGems update because the given version (${rubygemsVersionInput}) is not newer than the default version (${gemVersion})`)
  }

  return true
}

// Older RubyGems versions do not account for 'required_ruby_version' when
// running 'gem update --system', so we have to force a compatible version of
// rubygems-update.  See https://github.com/ruby/setup-ruby/pull/551 and
// https://github.com/rubygems/rubygems/issues/7329
async function rubygemsLatest(gem, platform, engine, version) {
  if (engine === 'ruby') {
    const rubyFloatVersion = common.floatVersion(version)
    if (common.isHeadVersion(version)) {
      console.log('Ruby master builds use included RubyGems')
    } else if (rubyFloatVersion >= 3.0) {
      await exec.exec(gem, ['update', '--system'])
    } else if (rubyFloatVersion >= 2.6) {
      await exec.exec(gem, ['update', '--system', '3.4.22'])
    } else if (rubyFloatVersion >= 2.3) {
      await exec.exec(gem, ['update', '--system', '3.3.27'])
    } else {
      console.log(`Cannot update RubyGems for Ruby version ${version}`)
    }
  } else {
    // non MRI Rubies (TruffleRuby and JRuby)
    await exec.exec(gem, ['update', '--system'])
  }
}
