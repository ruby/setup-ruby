#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "open3"
require "uri"

ALLOWED_FILES = [
  "README.md",
  "dist/index.js",
  "ruby-builder-versions.json",
  "windows-toolchain-versions.json",
  "windows-versions.json",
].freeze

WINDOWS_TOOLCHAIN_URL_PREFIXES = [
  "https://github.com/ruby/setup-msys2-gcc/releases/",
  "https://github.com/oneclick/rubyinstaller/releases/download/devkit-",
].freeze

WINDOWS_VERSIONS_URL_PREFIXES = [
  "https://github.com/oneclick/rubyinstaller2/releases/download/",
  "https://github.com/oneclick/rubyinstaller/releases/download/",
  "https://github.com/MSP-Greg/ruby-loco/releases/download/",
].freeze

class AutomergeCheck
  attr_reader :errors

  def initialize(base_ref, head_ref = "HEAD")
    @base_ref = base_ref
    @head_ref = head_ref
    @errors = []
  end

  def run
    check_changed_files
    check_windows_toolchain_urls
    check_windows_versions_urls

    if @errors.empty?
      puts "All checks passed."
      true
    else
      puts "Automerge check failed:"
      @errors.each { |e| puts "  - #{e}" }
      false
    end
  end

  def check_changed_files(changed_files = git_changed_files)
    disallowed = changed_files - ALLOWED_FILES

    if disallowed.any?
      @errors << "Disallowed files changed: #{disallowed.join(', ')}"
    end
  end

  def check_windows_toolchain_urls(filename = "windows-toolchain-versions.json")
    check_json_urls(filename, WINDOWS_TOOLCHAIN_URL_PREFIXES)
  end

  def check_windows_versions_urls(filename = "windows-versions.json")
    check_json_urls(filename, WINDOWS_VERSIONS_URL_PREFIXES)
  end

  def check_json_urls(filename, allowed_prefixes)
    content = read_file_at_ref(filename)
    return unless content

    check_json_urls_from_content(filename, content, allowed_prefixes)
  end

  def check_json_urls_from_content(filename, content, allowed_prefixes)
    data = JSON.parse(content)
    urls = extract_urls(data)

    urls.each do |url|
      begin
        canonical_url = canonicalize_url(url)
      rescue URI::InvalidURIError
        @errors << "#{filename}: invalid URL #{url}"
        next
      end
      unless allowed_prefixes.any? { |prefix| canonical_url.start_with?(prefix) }
        @errors << "#{filename}: invalid URL #{url}"
      end
    end
  end

  def canonicalize_url(url)
    uri = URI.parse(url)
    if uri.path
      decoded_path = URI.decode_www_form_component(uri.path)
      uri.path = File.expand_path(decoded_path)
    end
    uri.to_s
  end

  def read_file_at_ref(filename)
    output, _, status = Open3.capture3("git", "show", "#{@head_ref}:#{filename}")
    unless status.success?
      @errors << "#{filename} missing at #{@head_ref}"
      return nil
    end
    output
  end

  def extract_urls(data)
    data.values.flat_map(&:values)
  end

  private

  def git_changed_files
    output, status = Open3.capture2("git", "diff", "--name-only", "#{@base_ref}...#{@head_ref}")
    unless status.success?
      raise "git diff failed: #{output}"
    end
    output.split("\n").map(&:strip).reject(&:empty?)
  end
end

if __FILE__ == $0
  if ARGV[0] == "--test"
    ARGV.clear
    require "minitest/autorun"

    class AutomergeCheckTest < Minitest::Test
      def setup
        @checker = AutomergeCheck.new("master")
      end

      def test_allowed_files_not_flagged
        @checker.check_changed_files(["README.md", "dist/index.js"])
        assert_empty @checker.errors
      end

      def test_disallowed_files_detected
        @checker.check_changed_files(["README.md", "evil.js", "dist/index.js"])
        assert_equal 1, @checker.errors.length
        assert_match(/evil\.js/, @checker.errors.first)
      end

      def test_all_allowed_files_accepted
        @checker.check_changed_files(ALLOWED_FILES)
        assert_empty @checker.errors
      end

      def test_url_extraction_simple
        data = { "3.0.0" => { "x64" => "https://example.com/a.7z" } }
        urls = @checker.extract_urls(data)
        assert_equal ["https://example.com/a.7z"], urls
      end

      def test_url_extraction_nested
        data = {
          "3.0.0" => { "x64" => "https://example.com/a.7z" },
          "3.1.0" => { "x64" => "https://example.com/b.7z", "arm64" => "https://example.com/c.7z" },
        }
        urls = @checker.extract_urls(data)
        assert_equal 3, urls.length
      end

      def test_url_extraction_extracts_all_values
        data = {
          "3.0.0" => { "x64" => "https://example.com/a.7z" },
          "3.1.0" => { "x64" => "not a url" },
        }
        urls = @checker.extract_urls(data)
        assert_includes urls, "https://example.com/a.7z"
        assert_includes urls, "not a url"
      end

      def test_valid_toolchain_urls
        valid_urls = [
          "https://github.com/ruby/setup-msys2-gcc/releases/latest/download/msys2-ucrt64.7z",
          "https://github.com/ruby/setup-msys2-gcc/releases/download/v1/file.7z",
          "https://github.com/oneclick/rubyinstaller/releases/download/devkit-4.7.2/DevKit.exe",
        ]
        valid_urls.each do |url|
          result = WINDOWS_TOOLCHAIN_URL_PREFIXES.any? { |p| url.start_with?(p) }
          assert result, "Expected #{url} to be valid for toolchain"
        end
      end

      def test_invalid_toolchain_urls
        invalid_urls = [
          "https://evil.com/malware.exe",
          "https://github.com/attacker/evil/releases/download/v1/bad.7z",
          "https://github.com/oneclick/rubyinstaller2/releases/download/v1/file.7z",
        ]
        invalid_urls.each do |url|
          result = WINDOWS_TOOLCHAIN_URL_PREFIXES.any? { |p| url.start_with?(p) }
          refute result, "Expected #{url} to be invalid for toolchain"
        end
      end

      def test_valid_versions_urls
        valid_urls = [
          "https://github.com/oneclick/rubyinstaller2/releases/download/RubyInstaller-3.0.0-1/file.7z",
          "https://github.com/oneclick/rubyinstaller/releases/download/ruby-2.0.0-p648/file.7z",
          "https://github.com/MSP-Greg/ruby-loco/releases/download/ruby-master/ruby-mingw.7z",
        ]
        valid_urls.each do |url|
          result = WINDOWS_VERSIONS_URL_PREFIXES.any? { |p| url.start_with?(p) }
          assert result, "Expected #{url} to be valid for versions"
        end
      end

      def test_invalid_versions_urls
        invalid_urls = [
          "https://evil.com/malware.exe",
          "https://github.com/attacker/evil/releases/download/v1/bad.7z",
        ]
        invalid_urls.each do |url|
          result = WINDOWS_VERSIONS_URL_PREFIXES.any? { |p| url.start_with?(p) }
          refute result, "Expected #{url} to be invalid for versions"
        end
      end

      def test_check_json_urls_from_content_with_valid_urls
        content = JSON.generate({
          "3.0.0" => { "x64" => "https://github.com/ruby/setup-msys2-gcc/releases/latest/download/file.7z" },
        })
        @checker.check_json_urls_from_content("test.json", content, WINDOWS_TOOLCHAIN_URL_PREFIXES)
        assert_empty @checker.errors
      end

      def test_check_json_urls_from_content_with_invalid_urls
        content = JSON.generate({
          "3.0.0" => { "x64" => "https://evil.com/malware.exe" },
        })
        @checker.check_json_urls_from_content("test.json", content, WINDOWS_TOOLCHAIN_URL_PREFIXES)
        assert_equal 1, @checker.errors.length
        assert_match(/invalid URL/, @checker.errors.first)
      end

      def test_path_traversal_urls_are_rejected
        malicious_urls = [
          "https://github.com/ruby/setup-msys2-gcc/releases/../../evil-repo/releases/download/malware.exe",
          "https://github.com/ruby/setup-msys2-gcc/releases/./../../evil-repo/releases/download/malware.exe",
          "https://github.com/ruby/setup-msys2-gcc/releases/%2E%2E/%2E%2E/evil-repo/releases/download/malware.exe",
        ]
        malicious_urls.each do |url|
          checker = AutomergeCheck.new("master")
          content = JSON.generate({ "3.0.0" => { "x64" => url } })
          checker.check_json_urls_from_content("test.json", content, WINDOWS_TOOLCHAIN_URL_PREFIXES)
          assert_equal 1, checker.errors.length, "Expected path traversal URL to be rejected: #{url}"
        end
      end

      def test_malformed_urls_are_rejected
        malformed_urls = [
          "https://evil.com/file\x00.exe",  # null byte causes URI::InvalidURIError
          "not a url at all",               # not a valid URI
          "https://github.com/ruby/setup-msys2-gcc/releases/\x00malware.exe",  # matches allowed prefix but malformed
        ]
        malformed_urls.each do |url|
          checker = AutomergeCheck.new("master")
          content = JSON.generate({ "3.0.0" => { "x64" => url } })
          checker.check_json_urls_from_content("test.json", content, WINDOWS_TOOLCHAIN_URL_PREFIXES)
          assert_equal 1, checker.errors.length, "Expected malformed URL to be rejected: #{url.inspect}"
          assert_match(/invalid URL/, checker.errors.first)
        end
      end

      def test_read_file_at_ref_returns_nil_for_missing_file
        result = @checker.send(:read_file_at_ref, "nonexistent-file-that-does-not-exist.json")
        assert_nil result
        assert_match(/missing/, @checker.errors.first)
      end

      def test_check_json_urls_records_error_when_file_missing
        @checker.check_json_urls("nonexistent-file-that-does-not-exist.json", WINDOWS_TOOLCHAIN_URL_PREFIXES)
        assert_includes @checker.errors.join("\n"), "nonexistent-file-that-does-not-exist.json missing"
      end
    end
  elsif ARGV.length < 1 || ARGV.length > 2
    puts "Usage: #{$0} <base-ref> [head-ref]"
    puts "       #{$0} --test"
    exit 1
  else
    base_ref = ARGV[0]
    head_ref = ARGV[1] || "HEAD"
    checker = AutomergeCheck.new(base_ref, head_ref)
    exit(checker.run ? 0 : 1)
  end
end
