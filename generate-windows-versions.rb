require 'open-uri'
require 'yaml'
require 'json'

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
versions['mswin'] = {
  'x64' => 'https://github.com/MSP-Greg/ruby-loco/releases/download/ruby-master/ruby-mswin.7z'
}
versions['ucrt'] = {
  'x64' => 'https://github.com/MSP-Greg/ruby-loco/releases/download/ruby-master/ruby-ucrt.7z'
}

File.binwrite 'windows-versions.json', "#{JSON.pretty_generate(versions)}\n"

base_url = 'https://github.com/ruby/setup-msys2-gcc/releases/latest/download/windows-toolchain.json'
windows_toolchain = JSON.parse(URI.open(base_url, &:read), symbolize_names: true)

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
      when 'mswin'
        "#{arch}-mswin64"
      else
        if version >= Gem::Version.new('3.1.0.dev')
          "#{arch}-mingw-ucrt"
        else
          "#{arch}-mingw32"
        end
      end

    toolchain =
      windows_toolchain.select do |pkg|
        pkg[:platform] == platform && pkg[:required_ruby_version].any? do |requirement|
          Gem::Requirement.new(requirement).satisfied_by?(version)
        end
      end

    unless toolchain.one?
      raise "#{toolchain.empty? ? 'no' : 'multiple'} toolchains found for #{raw_version} #{raw_arch}: #{toolchain}"
    end

    archs[raw_arch] = URI.join(base_url, toolchain.first[:href])
  end
end

File.binwrite 'windows-toolchain-versions.json', "#{JSON.pretty_generate(versions)}\n"
