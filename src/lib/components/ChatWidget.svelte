<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { 
    chatVisible, 
    chatMinimized, 
    chatConnected, 
    chatAuthenticated,
    chatError,
    activeRoom,
    joinedRooms,
    roomMessages,
    chatRooms,
    unreadMessages,
    totalUnreadCount,
    chatSettings,
    chat
  } from '$lib/stores/chat.js';
  import { walletAddress } from '$lib/stores/wallet.js';

  // Component state
  let messageInput = '';
  let messagesContainer;
  let isLoading = false;
  let showRoomList = false;
  let selectedRoom = null;

  // Reactive statements
  $: currentMessages = $activeRoom ? ($roomMessages.get($activeRoom) || []) : [];
  $: isConnected = $chatConnected && $chatAuthenticated;
  $: canSendMessage = isConnected && messageInput.trim().length > 0 && messageInput.length <= 500;

  onMount(async () => {
    // Initialize chat when component mounts
    await initializeChat();
  });

  onDestroy(() => {
    // Clean up when component is destroyed
    chat.disconnect();
  });

  /**
   * Initialize chat system
   */
  async function initializeChat() {
    try {
      isLoading = true;
      await chat.init();
      
      // Auto-connect if wallet is connected
      if ($walletAddress) {
        await connectAndAuthenticate();
      }
    } catch (error) {
      console.error('Failed to initialize chat:', error);
    } finally {
      isLoading = false;
    }
  }

  /**
   * Connect and authenticate with chat server
   */
  async function connectAndAuthenticate() {
    if (!$walletAddress) return;

    try {
      isLoading = true;
      
      // Connect to chat server
      const connected = await chat.connect();
      if (!connected) {
        throw new Error('Failed to connect to chat server');
      }

      // Authenticate with wallet address
      await chat.authenticate($walletAddress);

      // Wait a bit for rooms to be loaded, then join default room
      setTimeout(async () => {
        try {
          const globalRoom = $chatRooms.find(room => room.type === 'global' && room.name === 'Global Chat');
          if (globalRoom && globalRoom.id) {
            console.log('Attempting to join room:', globalRoom.id, globalRoom.name);
            await chat.joinRoom(globalRoom.id);
          } else {
            console.warn('Global Chat room not found in available rooms:', $chatRooms);
          }
        } catch (error) {
          console.error('Failed to join default room:', error);
          // Don't throw here - user can manually join rooms
        }
      }, 1000);

    } catch (error) {
      console.error('Failed to connect to chat:', error);
    } finally {
      isLoading = false;
    }
  }

  /**
   * Send a message
   */
  async function sendMessage() {
    if (!canSendMessage || !$activeRoom) return;

    const content = messageInput.trim();
    messageInput = '';

    try {
      await chat.sendMessage($activeRoom, content);
      
      // Scroll to bottom after sending message
      await tick();
      scrollToBottom();
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore message input on error
      messageInput = content;
    }
  }

  /**
   * Handle key press in message input
   */
  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  /**
   * Join a chat room
   */
  async function joinRoom(roomId) {
    try {
      await chat.joinRoom(roomId);
      chat.setActiveRoom(roomId);
      showRoomList = false;
    } catch (error) {
      console.error('Failed to join room:', error);
    }
  }

  /**
   * Leave a chat room
   */
  async function leaveRoom(roomId) {
    try {
      await chat.leaveRoom(roomId);
    } catch (error) {
      console.error('Failed to leave room:', error);
    }
  }

  /**
   * Switch to a different room
   */
  function switchRoom(roomId) {
    chat.setActiveRoom(roomId);
    showRoomList = false;
  }

  /**
   * Scroll messages to bottom
   */
  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * Format timestamp
   */
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Format wallet address for display
   */
  function formatWalletAddress(address) {
    if (!address) return 'Unknown';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  /**
   * Get room name by ID
   */
  function getRoomName(roomId) {
    const room = $chatRooms.find(r => r.id === roomId);
    return room ? room.name : roomId;
  }

  // Auto-scroll to bottom when new messages arrive
  $: if (currentMessages.length > 0) {
    tick().then(() => scrollToBottom());
  }

  // Auto-connect when wallet connects
  $: if ($walletAddress && !$chatAuthenticated) {
    connectAndAuthenticate();
  }
</script>

<!-- Chat Widget -->
{#if $chatVisible}
  <div class="chat-widget" class:minimized={$chatMinimized}>
    <!-- Chat Header -->
    <div class="chat-header">
      <div class="chat-title">
        <button 
          class="room-selector"
          on:click={() => showRoomList = !showRoomList}
          disabled={!isConnected}
        >
          <span class="room-name">
            {$activeRoom ? getRoomName($activeRoom) : 'Chat'}
          </span>
          <svg class="chevron" class:rotated={showRoomList} width="12" height="12" viewBox="0 0 12 12">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
        </button>
        
        <!-- Connection Status -->
        <div class="connection-status">
          {#if isLoading}
            <div class="status-indicator loading"></div>
          {:else if isConnected}
            <div class="status-indicator connected"></div>
          {:else}
            <div class="status-indicator disconnected"></div>
          {/if}
        </div>
      </div>

      <!-- Chat Controls -->
      <div class="chat-controls">
        <button 
          class="control-btn"
          on:click={chat.toggleMinimize}
          title={$chatMinimized ? 'Maximize' : 'Minimize'}
        >
          {#if $chatMinimized}
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M3 6h10v4H3z" fill="currentColor"/>
            </svg>
          {:else}
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M3 3h10v2H3zM3 6h10v2H3zM3 9h10v2H3z" fill="currentColor"/>
            </svg>
          {/if}
        </button>
        
        <button 
          class="control-btn"
          on:click={chat.toggleChat}
          title="Close Chat"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Room List Dropdown -->
    {#if showRoomList && !$chatMinimized}
      <div class="room-list">
        <div class="room-list-header">
          <h4>Available Rooms</h4>
        </div>
        
        {#each $chatRooms as room}
          <button 
            class="room-item"
            class:active={$activeRoom === room.id}
            class:joined={$joinedRooms.has(room.id)}
            on:click={() => $joinedRooms.has(room.id) ? switchRoom(room.id) : joinRoom(room.id)}
          >
            <div class="room-info">
              <span class="room-name">{room.name}</span>
              <span class="room-description">{room.description}</span>
            </div>
            
            {#if $unreadMessages.get(room.id) > 0}
              <div class="unread-badge">
                {$unreadMessages.get(room.id)}
              </div>
            {/if}
            
            {#if $joinedRooms.has(room.id)}
              <button 
                class="leave-room-btn"
                on:click|stopPropagation={() => leaveRoom(room.id)}
                title="Leave room"
              >
                ×
              </button>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Chat Content -->
    {#if !$chatMinimized}
      <div class="chat-content">
        <!-- Error Message -->
        {#if $chatError}
          <div class="error-message">
            <span>⚠️ {$chatError}</span>
            <button on:click={() => chatError.set(null)}>×</button>
          </div>
        {/if}

        <!-- Connection Status -->
        {#if !isConnected}
          <div class="connection-message">
            {#if isLoading}
              <div class="loading-spinner"></div>
              <span>Connecting to chat...</span>
            {:else if !$walletAddress}
              <span>Connect your wallet to join the chat</span>
            {:else}
              <span>Chat disconnected</span>
              <button on:click={connectAndAuthenticate}>Reconnect</button>
            {/if}
          </div>
        {/if}

        <!-- Messages -->
        <div class="messages-container" bind:this={messagesContainer}>
          {#if currentMessages.length === 0 && isConnected}
            <div class="empty-messages">
              <span>No messages yet. Start the conversation! 💬</span>
            </div>
          {/if}

          {#each currentMessages as message}
            <div class="message" class:own-message={message.walletAddress === $walletAddress}>
              <!-- Avatar -->
              <div class="message-avatar">
                {#if message.avatarUrl}
                  <img src={message.avatarUrl} alt={message.nickname} />
                {:else}
                  <div class="default-avatar">
                    {message.nickname ? message.nickname.charAt(0).toUpperCase() : '?'}
                  </div>
                {/if}
              </div>

              <!-- Message Content -->
              <div class="message-content">
                <div class="message-header">
                  <span class="message-author">
                    {message.nickname || formatWalletAddress(message.walletAddress)}
                  </span>
                  {#if $chatSettings.showTimestamps}
                    <span class="message-time">
                      {formatTime(message.created_at || message.timestamp)}
                    </span>
                  {/if}
                </div>
                
                <div class="message-text">
                  {message.content || message.message_content}
                </div>
              </div>
            </div>
          {/each}
        </div>

        <!-- Message Input -->
        {#if isConnected && $activeRoom}
          <div class="message-input-container">
            <div class="input-wrapper">
              <textarea
                bind:value={messageInput}
                on:keydown={handleKeyPress}
                placeholder="Type your message... (Enter to send)"
                maxlength="500"
                rows="1"
                disabled={!isConnected}
              ></textarea>
              
              <button 
                class="send-button"
                on:click={sendMessage}
                disabled={!canSendMessage}
                title="Send message"
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <path d="M2 10l16-8-8 16-2-6-6-2z" fill="currentColor"/>
                </svg>
              </button>
            </div>
            
            <div class="input-footer">
              <span class="char-count" class:warning={messageInput.length > 450}>
                {messageInput.length}/500
              </span>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<!-- Chat Toggle Button -->
{#if !$chatVisible}
  <button 
    class="chat-toggle-btn"
    on:click={chat.toggleChat}
    title="Open Chat"
  >
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor"/>
    </svg>
    
    {#if $totalUnreadCount > 0}
      <div class="unread-badge">
        {$totalUnreadCount > 99 ? '99+' : $totalUnreadCount}
      </div>
    {/if}
  </button>
{/if}

<style>
  .chat-widget {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 350px;
    height: 500px;
    background: rgba(0, 0, 0, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    z-index: 1000;
    backdrop-filter: blur(10px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }

  .chat-widget.minimized {
    height: 50px;
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px 12px 0 0;
  }

  .chat-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .room-selector {
    background: none;
    border: none;
    color: white;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background-color 0.2s;
  }

  .room-selector:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  .room-selector:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .room-name {
    font-weight: 600;
    font-size: 14px;
  }

  .chevron {
    transition: transform 0.2s;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  .connection-status {
    display: flex;
    align-items: center;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-left: 8px;
  }

  .status-indicator.connected {
    background: #10b981;
  }

  .status-indicator.disconnected {
    background: #ef4444;
  }

  .status-indicator.loading {
    background: #f59e0b;
    animation: pulse 1.5s infinite;
  }

  .chat-controls {
    display: flex;
    gap: 8px;
  }

  .control-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .control-btn:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }

  .room-list {
    background: rgba(0, 0, 0, 0.9);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    max-height: 200px;
    overflow-y: auto;
  }

  .room-list-header {
    padding: 12px 16px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .room-list-header h4 {
    margin: 0;
    color: white;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .room-item {
    width: 100%;
    background: none;
    border: none;
    color: white;
    padding: 12px 16px;
    text-align: left;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background-color 0.2s;
    position: relative;
  }

  .room-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .room-item.active {
    background: rgba(59, 130, 246, 0.2);
  }

  .room-item.joined {
    border-left: 3px solid #10b981;
  }

  .room-info {
    flex: 1;
  }

  .room-info .room-name {
    display: block;
    font-weight: 600;
    font-size: 14px;
  }

  .room-info .room-description {
    display: block;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 2px;
  }

  .leave-room-btn {
    background: rgba(239, 68, 68, 0.2);
    border: none;
    color: #ef4444;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
  }

  .leave-room-btn:hover {
    background: rgba(239, 68, 68, 0.3);
  }

  .chat-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 8px 12px;
    margin: 8px;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }

  .error-message button {
    background: none;
    border: none;
    color: #ef4444;
    cursor: pointer;
    font-size: 16px;
    padding: 0;
    margin-left: 8px;
  }

  .connection-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
    gap: 12px;
  }

  .connection-message button {
    background: #3b82f6;
    border: none;
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty-messages {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    text-align: center;
  }

  .message {
    display: flex;
    gap: 8px;
    padding: 4px 0;
  }

  .message.own-message {
    flex-direction: row-reverse;
  }

  .message.own-message .message-content {
    background: rgba(59, 130, 246, 0.2);
    border-radius: 12px 4px 12px 12px;
  }

  .message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .message-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .default-avatar {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 14px;
  }

  .message-content {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    padding: 8px 12px;
    border-radius: 4px 12px 12px 12px;
    max-width: 80%;
  }

  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .message-author {
    font-weight: 600;
    font-size: 12px;
    color: #3b82f6;
  }

  .message-time {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
  }

  .message-text {
    color: white;
    font-size: 14px;
    line-height: 1.4;
    word-wrap: break-word;
  }

  .message-input-container {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding: 12px;
  }

  .input-wrapper {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .input-wrapper textarea {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px 12px;
    color: white;
    font-size: 14px;
    resize: none;
    min-height: 36px;
    max-height: 100px;
  }

  .input-wrapper textarea:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .input-wrapper textarea::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .send-button {
    background: #3b82f6;
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .send-button:hover:not(:disabled) {
    background: #2563eb;
  }

  .send-button:disabled {
    background: rgba(255, 255, 255, 0.1);
    cursor: not-allowed;
  }

  .input-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
  }

  .char-count {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
  }

  .char-count.warning {
    color: #f59e0b;
  }

  .chat-toggle-btn {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 60px;
    height: 60px;
    background: #3b82f6;
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
    transition: all 0.2s;
    z-index: 1000;
  }

  .chat-toggle-btn:hover {
    background: #2563eb;
    transform: scale(1.05);
  }

  .unread-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ef4444;
    color: white;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 16px;
    text-align: center;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .chat-widget {
      width: calc(100vw - 40px);
      height: calc(100vh - 100px);
      bottom: 10px;
      right: 10px;
      left: 10px;
    }

    .chat-toggle-btn {
      bottom: 10px;
      right: 10px;
    }
  }
</style>