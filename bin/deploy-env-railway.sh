#!/bin/bash

# Deploy Environment Variables to Railway using CLI with Rate Limiting
# Usage: ./bin/deploy-env-railway.sh [.env file path]

set -e

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file '$ENV_FILE' not found!"
    echo "💡 Create a .env file with your environment variables first."
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

# Function to deploy a single variable with retry logic
deploy_variable() {
    local key="$1"
    local value="$2"
    local max_retries=3
    local retry_count=0
    
    while [[ "$retry_count" -lt "$max_retries" ]]; do
        echo "📝 Setting $key... (attempt $((retry_count + 1)))"
        
        local output
        if output=$(railway variables --set "$key=$value" 2>&1); then
            echo "  ✅ $key set successfully"
            return 0
        else
            if echo "$output" | grep -qi "rate limit"; then
                echo "  ⚠️ Rate limited"
                local wait_time=$((2 ** retry_count * 3))  # 3s, 6s, 12s
                echo "  ⏳ Waiting ${wait_time}s before retry..."
                sleep "$wait_time"
                retry_count=$((retry_count + 1))
            else
                echo "  ❌ Failed to set $key: $output"
                return 1
            fi
        fi
    done
    
    echo "  ❌ Failed to set $key after $max_retries attempts"
    return 1
}

# Read .env file and collect all variables
variables=()
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
        
        variables+=("$key=$value")
    fi
done < "$ENV_FILE"

if [[ ${#variables[@]} -eq 0 ]]; then
    echo "⚠️ No environment variables found in $ENV_FILE"
    exit 1
fi

echo "🔍 Found ${#variables[@]} environment variables to deploy"
echo "⏳ This will take approximately $((${#variables[@]} * 3)) seconds with rate limiting..."

# Deploy variables individually with rate limiting
failed_vars=()
for var in "${variables[@]}"; do
    local key="${var%%=*}"
    local value="${var#*=}"
    
    if ! deploy_variable "$key" "$value"; then
        failed_vars+=("$key")
    fi
    
    # Respectful delay between requests to avoid rate limiting
    sleep 3
done

# Report results
if [[ ${#failed_vars[@]} -eq 0 ]]; then
    echo "✅ All ${#variables[@]} environment variables deployed successfully!"
    echo "🔍 You can verify them with: railway variables"
    echo "🚀 Deploy your service with: railway up"
else
    echo "⚠️ Some variables failed to deploy:"
    printf '  - %s\n' "${failed_vars[@]}"
    echo "💡 You can retry failed variables manually with: railway variables --set KEY=VALUE"
    exit 1
fi