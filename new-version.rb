engine, version = ARGV.fetch(0).split('-', 2)

MATCH = case engine
when 'ruby', 'jruby'
  /^\d+\.\d+\./
when 'truffleruby'
  /^\d+\./
end

raise unless version[MATCH]

# Update ruby-builder-versions.json
file = "#{__dir__}/ruby-builder-versions.json"
lines = File.readlines(file, chomp: true)

from = lines.index { |line| line =~ /"#{engine}": \[/ }
to = from
to += 1 until lines[to].include?(']')

from += 1 # [
to -= 2 # head, ]

puts lines[from..to]

release_line = lines[from..to].find { |line|
  v = line[/"([^"]+)"/, 1] and v[MATCH] == version[MATCH]
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
engine_line.sub!(/(.+ (?:-|until)) (\d+(?:\.\d+)+)/) do
  if Gem::Version.new(version) > Gem::Version.new($2)
    "#{$1} #{version}"
  else
    $&
  end
end
File.write(file, lines.join)
