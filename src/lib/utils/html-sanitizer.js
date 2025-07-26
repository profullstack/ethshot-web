/**
 * HTML Sanitization Utilities
 * 
 * Provides secure HTML entity encoding to prevent XSS attacks
 */

/**
 * HTML entity encoding map for dangerous characters
 */
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * Encode HTML entities to prevent XSS attacks
 * @param {string} text - The text to encode
 * @returns {string} HTML-safe encoded text
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') {
    return '';
  }
  
  return text.replace(/[&<>"'`=\/]/g, (match) => HTML_ENTITIES[match]);
}

/**
 * Sanitize and format chat message with mentions
 * This replaces the unsafe {@html} usage with secure text rendering
 * @param {string} content - The message content
 * @returns {string} Sanitized HTML with safe mention formatting
 */
export function sanitizeMessageWithMentions(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // First, escape all HTML entities to prevent XSS
  const escapedContent = escapeHtml(content);
  
  // Then safely format mentions by replacing @username patterns
  // This creates safe HTML spans for mentions without allowing arbitrary HTML
  const mentionPattern = /@([a-zA-Z0-9_-]+)/g;
  
  return escapedContent.replace(mentionPattern, (match, username) => {
    // Create safe HTML for mentions - all content is already escaped
    return `<span class="mention">@${username}</span>`;
  });
}

/**
 * Sanitize user input for display
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized text safe for display
 */
export function sanitizeUserInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  
  return escapeHtml(input.trim());
}

/**
 * Sanitize nickname for display
 * @param {string} nickname - Nickname to sanitize
 * @returns {string} Sanitized nickname
 */
export function sanitizeNickname(nickname) {
  if (!nickname || typeof nickname !== 'string') {
    return '';
  }
  
  // Remove any HTML tags and encode entities
  const cleaned = nickname.replace(/<[^>]*>/g, '');
  return escapeHtml(cleaned.trim());
}