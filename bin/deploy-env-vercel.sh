#!/bin/bash

# Deploy Environment Variables to Vercel
# Usage: ./bin/deploy-env-vercel.sh [.env file path] [project-name]

set -e

ENV_FILE="${1:-.env}"
PROJECT_NAME="${2}"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file '$ENV_FILE' not found!"
    echo "💡 Create a .env file with your environment variables first."
    exit 1
fi

echo "🚀 Deploying environment variables from '$ENV_FILE' to Vercel..."

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found!"
    echo "💡 Install it with: npm install -g vercel"
    exit 1
fi

# Check if logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo "❌ Not logged in to Vercel!"
    echo "💡 Login with: vercel login"
    exit 1
fi

# Build project argument if provided
PROJECT_ARG=""
if [ -n "$PROJECT_NAME" ]; then
    PROJECT_ARG="--scope $PROJECT_NAME"
    echo "📦 Using project: $PROJECT_NAME"
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
        
        # Remove existing variable first (ignore errors if it doesn't exist)
        vercel env rm "$key" production $PROJECT_ARG --yes 2>/dev/null || true
        vercel env rm "$key" preview $PROJECT_ARG --yes 2>/dev/null || true
        vercel env rm "$key" development $PROJECT_ARG --yes 2>/dev/null || true
        
        # Set environment variable for all environments (production, preview, development)
        vercel env add "$key" production $PROJECT_ARG <<< "$value"
        vercel env add "$key" preview $PROJECT_ARG <<< "$value"
        vercel env add "$key" development $PROJECT_ARG <<< "$value"
        
        sleep 0.5  # Small delay to avoid rate limiting
    fi
done < "$ENV_FILE"

echo "✅ Environment variables deployed successfully!"
echo "🔍 You can verify them with: vercel env ls $PROJECT_ARG"
echo "🚀 Deploy your project with: vercel --prod $PROJECT_ARG"