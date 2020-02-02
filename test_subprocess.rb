require 'rbconfig'
require 'stringio'

puts "CPPFLAGS: #{RbConfig::CONFIG["CPPFLAGS"]}"

$stderr = StringIO.new
begin
  system RbConfig.ruby, "-e", "p :OK"
  out = $stderr.string
ensure
  $stderr = STDERR
end
abort out unless out.empty?
