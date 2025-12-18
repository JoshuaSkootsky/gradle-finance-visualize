#!/bin/bash

# Test script for groovy-visualization project

echo "🧪 Running Complete Test Suite"
echo "=============================="

# Backend tests
echo "📊 Backend Tests (Groovy/JUnit)"
echo "-----------------------------------"
./gradlew test
if [ $? -eq 0 ]; then
    echo "✅ Backend tests passed"
else
    echo "❌ Backend tests failed"
    exit 1
fi

echo ""

# Frontend tests
echo "⚛️ Frontend Tests (React/Vitest)"
echo "----------------------------------"
cd frontend
bun test
if [ $? -eq 0 ]; then
    echo "✅ Frontend tests passed"
else
    echo "❌ Frontend tests failed"
    exit 1
fi

echo ""
echo "🎉 All tests passed successfully!"
echo "================================="