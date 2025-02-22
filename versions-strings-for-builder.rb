require 'json'
hash = File.read('ruby-builder-versions.json')
versions = JSON.load(hash).transform_keys(&:to_sym)

ONLY_LATEST_PATCH = ENV['ONLY_LATEST_PATCH']

def filter(versions)
  versions -= %w[head]
  if ONLY_LATEST_PATCH
    versions = versions.group_by { |v| v[/^\d+\.\d+/] }.map { _2.last }
  end
  versions
end

if ONLY_LATEST_PATCH
  puts filter(versions[:ruby]).map { |v| "ruby-#{v}" }.join(', ')
else
  by_minor = versions[:ruby].group_by { |v| v[/^\d+\.\d+/] }
  by_minor.each_pair do |minor, versions|
    puts versions.map { |v| "ruby-#{v}" }.join(', ') if minor
  end
end

puts
puts filter(versions[:truffleruby]).map { |v| "truffleruby-#{v}" }.join(', ')

puts
puts filter(versions[:"truffleruby+graalvm"]).map { |v| "truffleruby+graalvm-#{v}" }.join(', ')

puts
puts filter(versions[:jruby]).map { |v| "jruby-#{v}" }.join(', ')
puts "For Windows:"
puts filter(versions[:jruby]).join(', ')
