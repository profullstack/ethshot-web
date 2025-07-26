/**
 * Chat Mention Utilities
 * Handles @nickname detection, parsing, and formatting for chat messages
 */

/**
 * Regular expression for matching valid @nickname mentions
 * Matches @followed by alphanumeric characters and underscores, 2-32 chars long
 */
const MENTION_REGEX = /@([a-zA-Z][a-zA-Z0-9_]{1,31})\b/g;

/**
 * Regular expression for validating nickname format
 * Must start with letter, can contain letters, numbers, underscores, 2-32 chars total
 */
const NICKNAME_VALIDATION_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{1,31}$/;

/**
 * Extract all @nickname mentions from a message
 * @param {string} message - The message content to parse
 * @returns {string[]} Array of unique nicknames mentioned (without @ symbol)
 */
export function extractMentions(message) {
  if (!message || typeof message !== 'string') {
    return [];
  }

  const mentions = [];
  const matches = message.matchAll(MENTION_REGEX);
  
  for (const match of matches) {
    const nickname = match[1];
    if (nickname && !mentions.includes(nickname)) {
      mentions.push(nickname);
    }
  }
  
  return mentions;
}

/**
 * Format a message by wrapping @mentions in HTML spans
 * Also escapes HTML to prevent XSS attacks
 * @param {string} message - The message content to format
 * @returns {string} HTML-formatted message with mentions highlighted
 */
export function formatMessageWithMentions(message) {
  if (!message || typeof message !== 'string') {
    return '';
  }

  // First escape HTML to prevent XSS
  const escapedMessage = escapeHtml(message);
  
  // Then replace mentions with spans
  return escapedMessage.replace(MENTION_REGEX, '<span class="mention">@$1</span>');
}

/**
 * Validate if a nickname follows the correct format
 * @param {string} nickname - The nickname to validate
 * @returns {boolean} True if nickname is valid format
 */
export function validateNickname(nickname) {
  if (!nickname || typeof nickname !== 'string') {
    return false;
  }
  
  return NICKNAME_VALIDATION_REGEX.test(nickname);
}

/**
 * Search for nicknames that match a query (for autocomplete)
 * @param {string} query - The search query
 * @param {Array} users - Array of user objects with nickname property
 * @param {number} limit - Maximum number of results to return
 * @returns {Array} Array of matching user objects
 */
export function searchNicknames(query, users = [], limit = 10) {
  if (!Array.isArray(users)) {
    return [];
  }

  const normalizedQuery = (query || '').toLowerCase();
  
  const matches = users.filter(user => {
    if (!user?.nickname) return false;
    return user.nickname.toLowerCase().startsWith(normalizedQuery);
  });

  // Sort by nickname length (shorter matches first) then alphabetically
  matches.sort((a, b) => {
    const lengthDiff = a.nickname.length - b.nickname.length;
    if (lengthDiff !== 0) return lengthDiff;
    return a.nickname.localeCompare(b.nickname);
  });

  return matches.slice(0, limit);
}

/**
 * Check if a mention is valid against a list of valid nicknames
 * @param {string} nickname - The nickname to validate
 * @param {string[]} validNicknames - Array of valid nicknames
 * @returns {boolean} True if mention is valid
 */
export function isMentionValid(nickname, validNicknames = []) {
  if (!nickname || typeof nickname !== 'string') {
    return false;
  }
  
  if (!Array.isArray(validNicknames)) {
    return false;
  }
  
  return validNicknames.includes(nickname);
}

/**
 * Escape HTML characters to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Parse message for mentions and return structured data
 * @param {string} message - The message content
 * @param {Array} availableUsers - Array of users available for mentioning
 * @returns {Object} Parsed message data with mentions info
 */
export function parseMessageMentions(message, availableUsers = []) {
  const mentions = extractMentions(message);
  const validMentions = [];
  const invalidMentions = [];
  
  const userNicknames = availableUsers.map(user => user.nickname).filter(Boolean);
  
  for (const mention of mentions) {
    if (isMentionValid(mention, userNicknames)) {
      const user = availableUsers.find(u => u.nickname === mention);
      if (user) {
        validMentions.push({
          nickname: mention,
          walletAddress: user.wallet_address,
          avatarUrl: user.avatar_url
        });
      }
    } else {
      invalidMentions.push(mention);
    }
  }
  
  return {
    originalMessage: message,
    formattedMessage: formatMessageWithMentions(message),
    mentions: validMentions,
    invalidMentions,
    hasMentions: validMentions.length > 0
  };
}

/**
 * Get cursor position for autocomplete suggestions
 * @param {string} message - Current message content
 * @param {number} cursorPosition - Current cursor position
 * @returns {Object|null} Autocomplete context or null if not in mention
 */
export function getAutocompleteContext(message, cursorPosition) {
  if (!message || cursorPosition < 0) {
    return null;
  }
  
  // Find the last @ symbol before cursor position
  const beforeCursor = message.substring(0, cursorPosition);
  const lastAtIndex = beforeCursor.lastIndexOf('@');
  
  if (lastAtIndex === -1) {
    return null;
  }
  
  // Check if there's a space between @ and cursor (invalid mention)
  const afterAt = beforeCursor.substring(lastAtIndex + 1);
  if (afterAt.includes(' ')) {
    return null;
  }
  
  // Check if we're still in the same word
  const afterCursor = message.substring(cursorPosition);
  const nextSpace = afterCursor.indexOf(' ');
  const wordEnd = nextSpace === -1 ? message.length : cursorPosition + nextSpace;
  
  return {
    startIndex: lastAtIndex,
    endIndex: wordEnd,
    query: afterAt,
    isActive: true
  };
}