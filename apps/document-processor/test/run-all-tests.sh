#!/bin/bash

# Document Processor Test Runner
# This script creates test files and runs the full test suite

set -e  # Exit on any error

echo "🚀 Document Processor Test Suite"
echo "================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory, if not, change to it
if [ ! -f "create-test-files.ts" ]; then
    if [ -f "test/create-test-files.ts" ]; then
        print_status "Changing to test directory..."
        cd test
    else
        print_error "Please run this script from the document-processor directory or test subdirectory"
        exit 1
    fi
fi

# Check if document processor is running
print_status "Checking if document processor is running..."
if curl -s http://localhost:4001/health > /dev/null 2>&1; then
    print_success "Document processor is running"
else
    print_warning "Document processor is not running on localhost:4001"
    print_status "Starting document processor..."

    # Go back to the document-processor root if we're in test directory
    if [ -f "../package.json" ]; then
        cd ..
    fi

    npm run dev &
    SERVER_PID=$!

    # Go back to test directory for the rest of the script
    if [ -d "test" ]; then
        cd test
    fi

    # Wait for server to start
    print_status "Waiting for server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:4001/health > /dev/null 2>&1; then
            print_success "Document processor started successfully"
            break
        fi
        sleep 2
        if [ $i -eq 30 ]; then
            print_error "Document processor failed to start within 60 seconds"
            exit 1
        fi
    done
fi

# Step 1: Create test files
print_status "Step 1: Creating test files..."
if npm run test:create-files; then
    print_success "Test files created successfully"
else
    print_error "Failed to create test files"
    exit 1
fi

echo ""

# Step 2: Run tests
print_status "Step 2: Running test suite..."
if npm run test; then
    print_success "All tests completed successfully!"
else
    print_error "Some tests failed"
    exit 1
fi

echo ""
print_success "🎉 Test suite completed!"
print_status "Check test_files/test-results.json for detailed results"

# If we started the server, keep it running
if [ ! -z "$SERVER_PID" ]; then
    print_status "Document processor is still running (PID: $SERVER_PID)"
    print_status "Press Ctrl+C to stop it"
    wait $SERVER_PID
fi
