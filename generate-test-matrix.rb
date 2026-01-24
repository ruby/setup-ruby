require 'json'

# Returns unique semantic versions and symbolic versions
#
# segment_count = 1 returns unique major versions
# segment_count = 2 returns unique minor versions
# segment_count = 3 returns unique patch versions
def unique_versions(versions, segment_count, *symbolic)
  versions.filter_map do |version|
    next unless Gem::Version.correct?(version)

    ruby_version = Gem::Version.new(version)
    next if ruby_version.prerelease? && ruby_version.segments[-2] != 'p'

    ruby_version.segments[0, segment_count].join('.')
  end.uniq + versions.intersection(symbolic)
end

# Runners
runners = %w[
  macos-14
  macos-15
  macos-15-intel
  ubuntu-22.04
  ubuntu-24.04
  ubuntu-22.04-arm
  ubuntu-24.04-arm
  windows-2022
  windows-2025
  windows-11-arm
].freeze

macos_runners = runners.select { |runner| runner.start_with?('macos-') }
ubuntu_runners = runners.select { |runner| runner.start_with?('ubuntu-') }
windows_runners, non_windows_runners = runners.partition { |runner| runner.start_with?('windows-') }

macos_arm64_runners, _macos_x64_runners = macos_runners.partition { |runner| !runner.end_with?('-intel')}
ubuntu_arm64_runners, ubuntu_x64_runners = ubuntu_runners.partition { |runner| runner.end_with?('-arm')}
windows_arm64_runners, windows_x64_runners = windows_runners.partition { |runner| runner.end_with?('-arm') }

# Versions
ruby_builder_versions = JSON.load(File.read('ruby-builder-versions.json'))
windows_versions = JSON.load(File.read('windows-versions.json'))

# ruby: each minor release + head
ruby_versions = unique_versions(ruby_builder_versions['ruby'], 2, 'head')
windows_ruby_versions = unique_versions(windows_versions.keys, 2, 'head')
matrix = non_windows_runners.product(ruby_versions) + windows_runners.product(windows_ruby_versions)

# jruby: each major release + head
jruby_versions = unique_versions(ruby_builder_versions['jruby'], 1, 'head').map { |version| "jruby-#{version}" }
matrix += runners.product(jruby_versions)

# truffleruby: latest release + head
truffleruby_versions = %w[truffleruby truffleruby-head truffleruby+graalvm truffleruby+graalvm-head]
matrix += non_windows_runners.product(truffleruby_versions)

# ruby-loco: head
ruby_loco_versions = %w[mingw mswin ucrt]
matrix += windows_x64_runners.product(ruby_loco_versions)

# asan: latest release + head
asan_versions = %w[asan-release asan]
matrix += ubuntu_x64_runners.sort.last(1).product(asan_versions)

# https://github.com/ruby/setup-ruby/pull/596#discussion_r1606047680
matrix -= (ubuntu_runners - %w[ubuntu-22.04]).product(%w[1.9])
# https://github.com/ruby/setup-ruby/issues/496
matrix -= ubuntu_runners.product(%w[2.2])
# These old Rubies fail to compile on macOS arm64
matrix -= macos_arm64_runners.product(%w[1.9 2.0 2.1 2.2 2.3 2.4 2.5])
# These old Rubies fail to compile or segfault on Linux arm64
matrix -= ubuntu_arm64_runners.product(%w[1.9 2.0 2.1 2.2])
# RubyInstaller windows-arm64 builds only exist for Ruby 3.4+
matrix -= windows_arm64_runners.product(%w[2.0 2.1 2.2 2.3 2.4 2.5 2.6 2.7 3.0 3.1 3.2 3.3])

puts(JSON.generate(matrix.sort.map { |os, ruby| { os:, ruby: } }))
