#!/usr/bin/env bash

# Detect OS
OS=$(uname)
if [ "$OS" = "Darwin" ]; then
  OS_NAME="macosx"
elif [ "$OS" = "Linux" ]; then
  OS_NAME="linux"
else
  echo "Unsupported OS: $OS"
  exit 1
fi

# Set architecture (assume x86_64 unless overridden)
ARCH="x86-64"
JVM_ARCH="x86_64"

# Gradle version
VER="8.14.3"
DIST_NAME="gradle-$VER-bin"

# Base URL for Gradle distribution
BASE_URL="https://services.gradle.org/distributions"

# Wrapper JAR path
WRAPPER_JAR="gradle/wrapper/gradle-wrapper.jar"
WRAPPER_PROPS="gradle/wrapper/gradle-wrapper.properties"

# Create wrapper directory
mkdir -p "gradle/wrapper"

# Download wrapper JAR if not present
if [ ! -f "$WRAPPER_JAR" ]; then
  echo "⏬ Downloading Gradle Wrapper JAR..."
  curl -f -L -o "$WRAPPER_JAR" "$BASE_URL/$VER/$DIST_NAME-wrapper.jar" || {
    echo "❌ Failed to download $WRAPPER_JAR"
    exit 1
  }
fi

# Write properties
cat > "$WRAPPER_PROPS" << EOF
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=$BASE_URL/$DIST_NAME-$VER-$OS_NAME-$ARCH.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
EOF

# Java exec
JAVA_CMD=java

# Execute
exec "$JAVA_CMD" -Dorg.gradle.appname="gradlew" \
  -classpath "$WRAPPER_JAR" \
  org.gradle.wrapper.GradleWrapperMain "$@"
