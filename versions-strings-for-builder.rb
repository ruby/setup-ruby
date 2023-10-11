require 'json'
hash = File.read('ruby-builder-versions.json')
versions = JSON.load(hash).transform_keys(&:to_sym)

by_minor = versions[:ruby].group_by { |v| v[/^\d\.\d/] }

by_minor.each_pair do |minor, versions|
  puts versions.map { |v| "ruby-#{v}" }.join(', ') if minor
end

puts
puts (versions[:truffleruby] - %w[head]).map { |v| "truffleruby-#{v}" }.join(', ')

puts
puts (versions[:"truffleruby+graalvm"] - %w[head]).map { |v| "truffleruby+graalvm-#{v}" }.join(', ')

puts
puts (versions[:jruby] - %w[head]).map { |v| "jruby-#{v}" }.join(', ')

(versions[:jruby] - %w[head]).each do |v|
  puts "- { os: windows-latest, jruby-version: #{v}, ruby: jruby-#{v} }"
end
