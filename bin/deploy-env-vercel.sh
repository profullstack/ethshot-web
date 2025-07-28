#!/bin/bash

# Deploy Environment Variables to Vercel using REST API (Batch Mode)
# Usage: ./bin/deploy-env-vercel.sh [.env file path] [project-name]

set -e

ENV_FILE="${1:-.env}"
PROJECT_NAME="${2}"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file '$ENV_FILE' not found!"
    echo "💡 Create a .env file with your environment variables first."
    exit 1
fi

echo "🚀 Deploying environment variables from '$ENV_FILE' to Vercel using REST API..."

# Function to get Vercel token from CLI config
get_vercel_token() {
    local config_file="$HOME/.vercel/auth.json"
    if [[ -f "$config_file" ]]; then
        # Extract token from auth file
        grep -o '"token":"[^"]*"' "$config_file" | cut -d'"' -f4 | head -1
    else
        echo ""
    fi
}

# Function to get project ID from vercel.json or CLI
get_project_id() {
    local project_name="$1"
    
    # Try to get from vercel.json first
    if [[ -f "vercel.json" ]]; then
        local project_id
        project_id=$(grep -o '"name":"[^"]*"' vercel.json | cut -d'"' -f4 | head -1)
        if [[ -n "$project_id" ]]; then
            echo "$project_id"
            return 0
        fi
    fi
    
    # Try to get from .vercel/project.json
    if [[ -f ".vercel/project.json" ]]; then
        local project_id
        project_id=$(grep -o '"projectId":"[^"]*"' .vercel/project.json | cut -d'"' -f4 | head -1)
        if [[ -n "$project_id" ]]; then
            echo "$project_id"
            return 0
        fi
    fi
    
    # Use provided project name
    if [[ -n "$project_name" ]]; then
        echo "$project_name"
        return 0
    fi
    
    # Try to get current directory name as fallback
    basename "$(pwd)"
}

# Function to deploy variables using Vercel REST API
deploy_variables_batch() {
    local token="$1"
    local project_id="$2"
    local variables=("${@:3}")
    
    echo "📦 Deploying ${#variables[@]} variables in batch to project: $project_id"
    
    # Build JSON payload for batch update
    local json_envs=""
    for var in "${variables[@]}"; do
        local key="${var%%=*}"
        local value="${var#*=}"
        
        # Escape JSON special characters
        value=$(echo "$value" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\r/\\r/g; s/\t/\\t/g')
        
        if [[ -n "$json_envs" ]]; then
            json_envs="$json_envs,"
        fi
        json_envs="$json_envs{\"key\":\"$key\",\"value\":\"$value\",\"target\":[\"production\",\"preview\",\"development\"]}"
    done
    
    local temp_file=$(mktemp)
    local response_code
    
    # Make batch API call to update environment variables
    response_code=$(curl -s -w "%{http_code}" \
        -X PATCH \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{\"envs\":[$json_envs]}" \
        -o "$temp_file" \
        "https://api.vercel.com/v9/projects/$project_id/env" 2>/dev/null || echo "000")
    
    local response_body
    response_body=$(cat "$temp_file" 2>/dev/null || echo "")
    rm -f "$temp_file"
    
    if [[ "$response_code" == "200" ]]; then
        echo "✅ All ${#variables[@]} variables deployed successfully in batch!"
        return 0
    elif [[ "$response_code" == "401" ]]; then
        echo "❌ Authentication failed. Please check your Vercel token."
        echo "💡 Login with: vercel login"
        return 1
    elif [[ "$response_code" == "404" ]]; then
        echo "❌ Project not found: $project_id"
        echo "💡 Check your project name or ensure you're in the correct directory"
        return 1
    elif [[ "$response_code" == "429" ]]; then
        echo "❌ Rate limited by Vercel API"
        echo "💡 Wait a moment and try again"
        return 1
    else
        echo "❌ API call failed with HTTP $response_code"
        if [[ -n "$response_body" ]]; then
            echo "Response: $response_body"
        fi
        return 1
    fi
}

# Function to deploy variables individually (fallback)
deploy_variables_individually() {
    local variables=("$@")
    local failed_vars=()
    
    echo "🔄 Falling back to individual deployments using Vercel CLI..."
    
    # Check if vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        echo "❌ Vercel CLI not found!"
        echo "💡 Install it with: npm install -g vercel"
        return 1
    fi
    
    # Check if logged in to Vercel
    if ! vercel whoami &> /dev/null; then
        echo "❌ Not logged in to Vercel!"
        echo "💡 Login with: vercel login"
        return 1
    fi
    
    # Build project argument if provided
    local project_arg=""
    if [[ -n "$PROJECT_NAME" ]]; then
        project_arg="--scope $PROJECT_NAME"
        echo "📦 Using project: $PROJECT_NAME"
    fi
    
    for var in "${variables[@]}"; do
        local key="${var%%=*}"
        local value="${var#*=}"
        
        echo "📝 Setting $key..."
        
        # Remove existing variable first (ignore errors if it doesn't exist)
        vercel env rm "$key" production $project_arg --yes 2>/dev/null || true
        vercel env rm "$key" preview $project_arg --yes 2>/dev/null || true
        vercel env rm "$key" development $project_arg --yes 2>/dev/null || true
        
        # Set environment variable for all environments
        if echo "$value" | vercel env add "$key" production $project_arg && \
           echo "$value" | vercel env add "$key" preview $project_arg && \
           echo "$value" | vercel env add "$key" development $project_arg; then
            echo "  ✅ $key set successfully"
        else
            echo "  ❌ Failed to set $key"
            failed_vars+=("$key")
        fi
        
        sleep 0.5  # Small delay to avoid rate limiting
    done
    
    # Report results
    if [[ ${#failed_vars[@]} -eq 0 ]]; then
        echo "✅ All environment variables deployed successfully!"
        return 0
    else
        echo "⚠️ Some variables failed to deploy:"
        printf '  - %s\n' "${failed_vars[@]}"
        return 1
    fi
}

# Get Vercel token and project ID
VERCEL_TOKEN=$(get_vercel_token)
PROJECT_ID=$(get_project_id "$PROJECT_NAME")

if [[ -z "$PROJECT_ID" ]]; then
    echo "❌ Could not determine project ID"
    echo "💡 Provide project name as second argument or ensure vercel.json exists"
    exit 1
fi

# Function to clean environment variable value
clean_env_value() {
    local value="$1"
    
    # Remove leading/trailing whitespace (including newlines, tabs, etc.)
    value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Remove quotes if they wrap the entire value
    if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then
        value="${BASH_REMATCH[1]}"
    fi
    
    echo "$value"
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
        
        # Clean the value (remove whitespace, newlines, quotes)
        value=$(clean_env_value "$value")
        
        variables+=("$key=$value")
    fi
done < "$ENV_FILE"

if [[ ${#variables[@]} -eq 0 ]]; then
    echo "⚠️ No environment variables found in $ENV_FILE"
    exit 1
fi

echo "🔍 Found ${#variables[@]} environment variables to deploy"

# Try batch deployment first, fall back to individual if needed
if [[ -n "$VERCEL_TOKEN" ]]; then
    if deploy_variables_batch "$VERCEL_TOKEN" "$PROJECT_ID" "${variables[@]}"; then
        echo "🔍 You can verify them with: vercel env ls"
        echo "🚀 Deploy your project with: vercel --prod"
        exit 0
    else
        echo "🔄 Batch deployment failed, trying individual deployments..."
    fi
else
    echo "⚠️ No Vercel token found, falling back to CLI deployments..."
fi

# Fallback to individual deployments
if deploy_variables_individually "${variables[@]}"; then
    echo "🔍 You can verify them with: vercel env ls"
    echo "🚀 Deploy your project with: vercel --prod"
else
    exit 1
fi