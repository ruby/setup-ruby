hash = File.read('ruby-builder-versions.js')[/\bversions = {[^}]+}/]
versions = eval hash

by_minor = versions[:ruby].group_by { |v| v[/^\d\.\d/] }

(1..7).each do |minor|
  p by_minor["2.#{minor}"].map { |v| "ruby-#{v}" }
end

puts
p (versions[:truffleruby] - %w[head]).map { |v| "truffleruby-#{v}" }

puts
p (versions[:jruby] - %w[head]).map { |v| "jruby-#{v}" }

(versions[:jruby] - %w[head]).each do |v|
  puts "- { os: windows-latest, jruby-version: #{v}, ruby: jruby-#{v} }"
end
