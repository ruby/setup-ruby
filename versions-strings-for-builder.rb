hash = File.read('ruby-builder-versions.js')[/\bversions = {[^}]+}/]
versions = eval hash

by_minor = versions[:ruby].group_by { |v| v[/^\d\.\d/] }

p by_minor['2.1']
p by_minor['2.2']
p by_minor['2.3']

(4..7).each do |minor|
  p by_minor["2.#{minor}"].map { |v| "ruby-#{v}" }
end

p (versions[:jruby] - %w[head]).map { |v| "jruby-#{v}" }

p (versions[:truffleruby] - %w[head]).map { |v| "truffleruby-#{v}" }
