#!/usr/bin/env ruby
# frozen_string_literal: true

require "open3"

ALLOWED_FILES = [
  "README.md",
  "dist/index.js",
  "ruby-builder-versions.json",
  "windows-toolchain-versions.json",
  "windows-versions.json",
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
