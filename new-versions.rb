versions = ARGV.fetch(0).split(',').map(&:strip)
p versions

versions.each do |engine_version|
  puts engine_version
  engine, version = engine_version.split('-', 2)
  p [engine, version]

  if engine == 'windows'
    require_relative 'generate-windows-versions'
    exit
  end

  match = case engine
  when 'ruby', 'jruby'
    /^\d+\.\d+\./
  when 'truffleruby', 'truffleruby+graalvm'
    /^\d+\./
  end

  raise engine_version unless version[match]

  # Update ruby-builder-versions.json
  file = "#{__dir__}/ruby-builder-versions.json"
  lines = File.readlines(file, chomp: true)

  from = lines.index { |line| line.include?(%{"#{engine}": [}) }
  raise "Could not find start of #{engine}" unless from
  to = from
  to += 1 until lines[to].include?(']')

  from += 1 # [
  to -= 2 # head, ]

  puts lines[from..to]

  release_line = lines[from..to].find { |line|
    v = line[/"([^"]+)"/, 1] and v[match] == version[match]
  }

  if release_line
    append = " #{version.inspect},"
    release_line << append unless release_line.end_with?(append)
  else
    lines.insert to+1, "    #{version.inspect},"
  end

  File.write(file, lines.join("\n") + "\n")

  # Update README.md
  file = "#{__dir__}/README.md"
  lines = File.readlines(file)
  engine_line = lines.find { |line| line.start_with?("| `#{engine}`") }
  engine_line.sub!(/(.+ (?:-|until)) (\d+(?:\.\d+)+(?:-\w+)?)/) do
    if Gem::Version.new(version) > Gem::Version.new($2)
      "#{$1} #{version}"
    else
      $&
    end
  end
  File.write(file, lines.join)
end
