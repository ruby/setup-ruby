require 'open-uri'
require 'yaml'
require 'json'

# General rules:
# - All the static parts of the expected URL are checked literally.
# - Each path component must begin with [\w], or a more restrictive character set.
# - Percent (`%`) shall not be allowed to avoid any percent encoding.
WINDOWS_VERSIONS_URLS_REGEXPS = [
  %r{\A#{Regexp.escape 'https://github.com/oneclick/rubyinstaller/releases/download'}/\w[\w.-]*/\w[\w.-]*\z},
  %r{\A#{Regexp.escape 'https://github.com/oneclick/rubyinstaller2/releases/download'}/\w[\w.-]*/\w[\w.-]*\z},
  %r{\A#{Regexp.escape 'https://github.com/MSP-Greg/ruby-loco/releases/download'}/\w[\w.-]*/\w[\w.-]*\z}
].freeze

MSWIN_VERSIONS_URLS_REGEXPS = [
  %r{\A#{Regexp.escape 'https://cache.ruby-lang.org/pub/ruby/binaries/mswin64'}/\w[\w.-]*\.zip\z},
  %r{\A#{Regexp.escape 'https://cache.ruby-lang.org/pub/ruby/binaries/index.json'}\z}
].freeze

WINDOWS_TOOLCHAIN_VERSIONS_URLS_REGEXPS = [
  %r{\A#{Regexp.escape 'https://github.com/oneclick/rubyinstaller/releases/download/devkit-4.7.2/DevKit-mingw64-64-4.7.2-20130224-1432-sfx.exe'}\z},
  %r{\A#{Regexp.escape 'https://github.com/ruby/setup-msys2-gcc/releases/download'}/\w[\w.-]*/\w[\w@.-]*\z},
  %r{\A#{Regexp.escape 'https://github.com/ruby/setup-msys2-gcc/releases/latest/download'}/\w[\w@.-]*\z}
].freeze

# Validate all the URLs in the versions json
def validate(versions, allowed_urls_regexps)
  versions.values.flat_map(&:values).each do |url|
    if allowed_urls_regexps.none? { |regexp| regexp.match? url }
      raise SecurityError, "Unexpected URL: #{url}"
    end
  end
end

min_requirements = ['~> 2.0.0', '~> 2.1.9', '>= 2.2.6'].map { |req| Gem::Requirement.new(req) }

url = 'https://raw.githubusercontent.com/oneclick/rubyinstaller.org-website/master/_data/downloads.yaml'
entries = YAML.load(URI.open(url, &:read), symbolize_names: true)

versions = entries.select { |entry|
  entry[:filetype] == 'rubyinstaller7z' and
  entry[:name].include?('(x64)') || entry[:name].include?('(arm)')
}.group_by { |entry|
  entry[:name][/Ruby (\d+\.\d+\.\d+)/, 1]
}.map { |version, builds_by_version|
  builds = builds_by_version.group_by { |entry|
    entry[:name][/\((x64|arm)\)/, 1]
  }.map { |arch, builds_by_arch|
    arch = 'arm64' if arch == 'arm'
    unless builds_by_arch.sort_by { |build| build[:name] } == builds_by_arch.reverse
      raise "not sorted as expected for #{version}"
    end
    [arch, builds_by_arch.first[:href]]
  }.sort_by { |arch, builds|
    arch
  }.to_h
  [version, builds]
}.sort_by { |version, entry|
  Gem::Version.new(version)
}.select { |version, entry|
  min_requirements.any? { |req| req.satisfied_by?(Gem::Version.new(version)) }
}.to_h

latest_version = Gem::Version.new(versions.keys.last)
head_version = Gem::Version.new("#{latest_version.bump}.0dev")

versions['head'] = {
  'arm64' => 'https://github.com/oneclick/rubyinstaller2/releases/download/rubyinstaller-head/rubyinstaller-head-arm.7z',
  'x64' => 'https://github.com/oneclick/rubyinstaller2/releases/download/rubyinstaller-head/rubyinstaller-head-x64.7z'
}
versions['mingw'] = {
  'x64' => 'https://github.com/MSP-Greg/ruby-loco/releases/download/ruby-master/ruby-mingw.7z'
}
versions['ucrt'] = {
  'x64' => 'https://github.com/MSP-Greg/ruby-loco/releases/download/ruby-master/ruby-ucrt.7z'
}

validate(versions, WINDOWS_VERSIONS_URLS_REGEXPS)
File.binwrite 'windows-versions.json', "#{JSON.pretty_generate(versions)}\n"

base_url = 'https://github.com/ruby/setup-msys2-gcc/releases/latest/download/windows-toolchain.json'
windows_toolchain = JSON.parse(URI.open(base_url, &:read), symbolize_names: true)

find_toolchains = -> platform, version {
  windows_toolchain.select do |pkg|
    pkg[:platform] == platform && pkg[:required_ruby_version].any? do |requirement|
      Gem::Requirement.new(requirement).satisfied_by?(version)
    end
  end
}

versions.each do |raw_version, archs|
  version = Gem::Version.correct?(raw_version) ? Gem::Version.new(raw_version) : head_version

  archs.each_key do |raw_arch|
    arch = raw_arch == 'arm64' ? 'aarch64' : raw_arch

    platform =
      case raw_version
      when 'head', 'ucrt'
        "#{arch}-mingw-ucrt"
      when 'mingw'
        "#{arch}-mingw32"
      else
        if version >= Gem::Version.new('3.1.0.dev')
          "#{arch}-mingw-ucrt"
        else
          "#{arch}-mingw32"
        end
      end

    toolchain = find_toolchains.(platform, version)

    unless toolchain.one?
      raise "#{toolchain.empty? ? 'no' : 'multiple'} toolchains found for #{raw_version} #{raw_arch}: #{toolchain}"
    end

    archs[raw_arch] = URI.join(base_url, toolchain.first[:href]).to_s
  end
end

validate(versions, WINDOWS_TOOLCHAIN_VERSIONS_URLS_REGEXPS)
File.binwrite 'windows-toolchain-versions.json', "#{JSON.pretty_generate(versions)}\n"

mswin_index_url = 'https://cache.ruby-lang.org/pub/ruby/binaries/index.json'
mswin_builds = JSON.parse(URI.open(mswin_index_url, &:read), symbolize_names: true)[:builds].select { |build|
  build[:platform].end_with?('-mswin64_140')
}
mswin_arch = -> build { build[:platform].delete_suffix('-mswin64_140') }

release_builds = mswin_builds.select { |build|
  build[:channel] == 'release' && Gem::Version.new(build[:version]) >= Gem::Version.new('3.4')
}
dev_builds = mswin_builds.select { |build| build[:channel] == 'dev' }

mswin_versions = release_builds.group_by { |build|
  build[:version]
}.sort_by { |version, _|
  Gem::Version.new(version)
}.to_h { |version, builds|
  [version, builds.sort_by(&mswin_arch).to_h { |build| [mswin_arch.(build), build[:url]] }]
}

# The latest master build is picked from the index at runtime, see getLatestMswinHeadURL in windows.js
mswin_versions['head'] = dev_builds.map(&mswin_arch).uniq.sort.to_h { |arch| [arch, mswin_index_url] }

mswin_toolchain_versions = mswin_versions.to_h do |raw_version, archs|
  version = raw_version == 'head' ? head_version : Gem::Version.new(raw_version)

  toolchains = archs.filter_map do |raw_arch, _|
    arch = raw_arch == 'arm64' ? 'aarch64' : raw_arch
    toolchain = find_toolchains.("#{arch}-mswin64", version)

    raise "multiple toolchains found for mswin-#{raw_version} #{raw_arch}: #{toolchain}" if toolchain.size > 1

    # vcpkg packages for arm64 only exist for newer Rubies, skip builds that cannot get a toolchain
    [raw_arch, URI.join(base_url, toolchain.first[:href]).to_s] if toolchain.one?
  end
  [raw_version, toolchains.to_h]
end

mswin_versions.each do |raw_version, archs|
  archs.select! { |raw_arch, _| mswin_toolchain_versions[raw_version].key?(raw_arch) }
end

validate(mswin_versions, MSWIN_VERSIONS_URLS_REGEXPS)
File.binwrite 'windows-mswin-versions.json', "#{JSON.pretty_generate(mswin_versions)}\n"

validate(mswin_toolchain_versions, WINDOWS_TOOLCHAIN_VERSIONS_URLS_REGEXPS)
File.binwrite 'windows-mswin-toolchain-versions.json', "#{JSON.pretty_generate(mswin_toolchain_versions)}\n"
