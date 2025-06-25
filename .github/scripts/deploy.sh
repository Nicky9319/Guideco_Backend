#!/bin/bash

set -e  # Exit on any error

echo "🚀 Deploying to production..."

# Define target directory
TARGET_DIR="/var/www/backend"

# Clean old deployment
sudo rm -rf $TARGET_DIR  # Use -rf to avoid prompt and handle directories properly
sudo mkdir -p $TARGET_DIR

# Copy new files
sudo cp -r ./* $TARGET_DIR/

# Change ownership (optional, but safer if other services access this folder)
sudo chown -R ubuntu:ubuntu $TARGET_DIR

# Move into the target directory
cd $TARGET_DIR

# Install dependencies
npm install  # Only production deps

# Ensure .env file exists and add a value
touch .env
echo -e "$ENVIRONMENTAL_VARIABLES" > .env
sed -i 's/\r//g' .env

# Making the logs Directory
mkdir logs || rm -rf logs && mkdir logs

pm2 stop all || echo "⚠️ PM2 stop failed, continuing..."
pm2 flush
pm2 start process.json

sudo docker-compose down --volumes --remove-orphans || echo "⚠️ docker-compose down failed, continuing..."
sudo docker-compose up -d 

echo "✅ Deployment complete."