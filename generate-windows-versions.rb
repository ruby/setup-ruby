require 'net/http'
require 'yaml'
require 'json'

min_version = '2.2.6'
url = 'https://raw.githubusercontent.com/oneclick/rubyinstaller.org-website/master/_data/downloads.yaml'
entries = YAML.load(Net::HTTP.get(URI(url)), symbolize_names: true)

versions = entries.select { |entry|
  entry[:filetype] == 'rubyinstaller7z' and
  entry[:name].include?('(x64)')
}.group_by { |entry|
  entry[:name][/Ruby (\d+\.\d+\.\d+)/, 1]
}.map { |version, builds|
  unless builds.sort_by { |build| build[:name] } == builds.reverse
    raise "not sorted as expected for #{version}"
  end
  [version, builds.first]
}.sort_by { |version, entry|
  Gem::Version.new(version)
}.select { |version, entry|
  Gem::Version.new(version) >= Gem::Version.new(min_version)
}.map { |version, entry|
  [version, entry[:href]]
}.to_h

versions['head'] = 'https://github.com/oneclick/rubyinstaller2/releases/download/rubyinstaller-head/rubyinstaller-head-x64.7z'
versions['mingw'] = 'https://github.com/MSP-Greg/ruby-loco/releases/download/ruby-master/ruby-mingw.7z'
versions['mswin'] = 'https://github.com/MSP-Greg/ruby-loco/releases/download/ruby-master/ruby-mswin.7z'

js = "export const versions = #{JSON.pretty_generate(versions)}\n"
File.write 'windows-versions.js', js
