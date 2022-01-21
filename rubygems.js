const path = require('path')
const exec = require('@actions/exec')

export async function rubygemsUpdate(rubygemsVersionInput, rubyPrefix) {
  const gem = path.join(rubyPrefix, 'bin', 'gem')
  const rubygemsVersion = (rubygemsVersionInput === 'latest') ? [] : [rubygemsVersionInput]

  await exec.exec(gem, ['update', '--system', ...rubygemsVersion])

  return true
}
