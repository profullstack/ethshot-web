#!/bin/bash

# Deploy Environment Variables to Railway
# Usage: ./deploy-env.sh [.env file path]

set -e

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file '$ENV_FILE' not found!"
    echo "💡 Create a .env file with your environment variables first."
    echo "💡 You can copy from .env.example and fill in your values."
    exit 1
fi

echo "🚀 Deploying environment variables from '$ENV_FILE' to Railway..."

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found!"
    echo "💡 Install it with: npm install -g @railway/cli"
    exit 1
fi

# Check if logged in to Railway
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway!"
    echo "💡 Login with: railway login"
    exit 1
fi

# Read .env file and set variables
while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # Extract key=value pairs
    if [[ "$line" =~ ^[[:space:]]*([^=]+)=(.*)$ ]]; then
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        
        # Remove leading/trailing whitespace from key
        key=$(echo "$key" | xargs)
        
        # Remove quotes from value if present
        value=$(echo "$value" | sed 's/^["'\'']\|["'\'']$//g')
        
        echo "📝 Setting $key..."
        railway variables --set "$key=$value"
        sleep 1  # Avoid rate limiting
    fi
done < "$ENV_FILE"

echo "✅ Environment variables deployed successfully!"
echo "🔍 You can verify them with: railway variables"
echo "🚀 Deploy your service with: railway up"