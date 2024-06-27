require 'json'

def run(command_line)
  puts "$ #{command_line}"
  output = `#{command_line}`
  puts output
  raise $?.inspect unless $?.success?
  output
end

latest_release_tag = run 'gh release view --json tagName'
latest_release_tag = JSON.load(latest_release_tag).fetch('tagName')

raise latest_release_tag unless latest_release_tag =~ /\Av(\d+).(\d+).(\d+)\z/
tag = "v#{$1}.#{Integer($2)+1}.0"

run "gh release create --generate-notes --latest #{tag}"
