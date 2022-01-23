engine, version = ARGV.fetch(0).split('-', 2)

MATCH = case engine
when 'ruby', 'jruby'
  /^\d+\.\d+\./
when 'truffleruby'
  /^\d+\./
end

raise unless version[MATCH]

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
  release_line << " #{version.inspect},"
else
  lines.insert to+1, "    #{version.inspect},"
end

File.write(file, lines.join("\n") + "\n")
