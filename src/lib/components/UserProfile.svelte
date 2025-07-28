<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { profileStore, userProfile, profileLoading, profileError, uploadingAvatar, notificationsEnabled } from '../stores/profile.js';
  import { walletAddress } from '../stores/wallet.js';
  import { toastStore } from '../stores/toast.js';

  export let show = false;

  const dispatch = createEventDispatcher();

  // Form data
  let formData = {
    nickname: '',
    bio: '',
    avatarFile: null,
    notificationsEnabled: true
  };

  // Separate reactive variable for notifications to avoid reset issues
  let notificationsToggle = true;

  // Form state
  let saving = false;
  let nicknameAvailable = true;
  let nicknameChecking = false;
  let nicknameCheckTimeout = null;
  let avatarPreview = null;
  let fileInput;

  // Validation
  let errors = {
    nickname: '',
    bio: '',
    avatar: ''
  };

  // Track if we've initialized the form data for this modal session
  let formInitialized = false;
  let lastProfileData = null;

  // Load current profile data when modal opens or profile changes
  $: if (show && $userProfile && (!formInitialized || $userProfile !== lastProfileData)) {
    formData = {
      nickname: $userProfile.nickname || '',
      bio: $userProfile.bio || '',
      avatarFile: null,
      notificationsEnabled: $userProfile.notifications_enabled ?? true
    };
    notificationsToggle = $userProfile.notifications_enabled ?? true;
    avatarPreview = $userProfile.avatar_url;
    clearErrors();
    formInitialized = true;
    lastProfileData = $userProfile;
  }

  // Initialize with empty form if modal opens but no profile data yet
  $: if (show && !$userProfile && !formInitialized) {
    formData = {
      nickname: '',
      bio: '',
      avatarFile: null,
      notificationsEnabled: true
    };
    notificationsToggle = true;
    avatarPreview = null;
    clearErrors();
    formInitialized = true;
    lastProfileData = null;
  }

  // Reset form initialization flag when modal closes
  $: if (!show) {
    formInitialized = false;
    lastProfileData = null;
  }

  // Sync the separate notification toggle with formData
  $: formData.notificationsEnabled = notificationsToggle;

  // Watch nickname changes for availability checking
  $: if (formData.nickname && formData.nickname !== ($userProfile?.nickname || '')) {
    checkNicknameAvailability(formData.nickname);
  }

  const clearErrors = () => {
    errors = {
      nickname: '',
      bio: '',
      avatar: ''
    };
  };

  const checkNicknameAvailability = async (nickname) => {
    if (!nickname || nickname === ($userProfile?.nickname || '')) {
      nicknameAvailable = true;
      return;
    }

    // Clear previous timeout
    if (nicknameCheckTimeout) {
      clearTimeout(nicknameCheckTimeout);
    }

    // Debounce nickname checking
    nicknameCheckTimeout = setTimeout(async () => {
      nicknameChecking = true;
      try {
        nicknameAvailable = await profileStore.checkNicknameAvailability(nickname, $walletAddress);
      } catch (error) {
        console.error('Failed to check nickname availability:', error);
        nicknameAvailable = false;
      } finally {
        nicknameChecking = false;
      }
    }, 500);
  };

  const validateForm = () => {
    clearErrors();
    let isValid = true;

    // Nickname validation (optional but must be unique if provided)
    if (formData.nickname) {
      if (formData.nickname.length > 50) {
        errors.nickname = 'Nickname must be 50 characters or less';
        isValid = false;
      } else if (!nicknameAvailable && formData.nickname !== ($userProfile?.nickname || '')) {
        errors.nickname = 'Nickname is already taken';
        isValid = false;
      }
    }

    // Bio validation (optional)
    if (formData.bio && formData.bio.length > 500) {
      errors.bio = 'Bio must be 500 characters or less';
      isValid = false;
    }

    // Avatar validation
    if (formData.avatarFile) {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      if (formData.avatarFile.size > maxSize) {
        errors.avatar = 'Avatar file must be smaller than 5MB';
        isValid = false;
      } else if (!allowedTypes.includes(formData.avatarFile.type)) {
        errors.avatar = 'Avatar must be a JPEG, PNG, GIF, or WebP image';
        isValid = false;
      }
    }

    return isValid;
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      formData.avatarFile = file;
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        avatarPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    formData.avatarFile = null;
    avatarPreview = null;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    saving = true;
    try {
      let avatarUrl = $userProfile?.avatar_url;

      // If there's a new avatar file, upload it first and get the URL
      if (formData.avatarFile) {
        avatarUrl = await profileStore.uploadAvatar(formData.avatarFile, $walletAddress);
        toastStore.success('Avatar uploaded successfully!');
      }

      // Update profile with all data (including new avatar URL if uploaded)
      // Note: walletAddress is now obtained from authentication, not passed from client
      await profileStore.updateProfile({
        profileData: {
          nickname: formData.nickname || null,
          bio: formData.bio || null,
          avatarUrl: avatarUrl,
          notificationsEnabled: formData.notificationsEnabled
        }
      });

      toastStore.success('Profile updated successfully!');
      handleClose();
    } catch (error) {
      console.error('Failed to save profile:', error);
      toastStore.error(error.message || 'Failed to save profile');
    } finally {
      saving = false;
    }
  };

  const handleClose = () => {
    show = false;
    dispatch('close');
    
    // Reset form
    formData = {
      nickname: '',
      bio: '',
      avatarFile: null,
      notificationsEnabled: true
    };
    notificationsToggle = true;
    avatarPreview = null;
    clearErrors();
    
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Close modal on Escape key
  const handleKeydown = (event) => {
    if (event.key === 'Escape' && show) {
      handleClose();
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

{#if show}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" on:click={handleClose}>
    <div class="bg-gray-900 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto" on:click|stopPropagation>
      <!-- Header -->
      <div class="flex justify-between items-center p-6 border-b border-gray-700">
        <h2 class="text-xl font-bold text-white">Edit Profile</h2>
        <button
          on:click={handleClose}
          class="text-gray-400 hover:text-white transition-colors"
          disabled={saving || $uploadingAvatar}
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Form -->
      <form on:submit|preventDefault={handleSubmit} class="p-6 space-y-6">
        <!-- Avatar Section -->
        <div class="text-center">
          <div class="mb-4">
            {#if avatarPreview}
              <img
                src={avatarPreview}
                alt="Avatar preview"
                class="w-24 h-24 rounded-full mx-auto object-cover border-2 border-gray-600"
              />
            {:else}
              <div class="w-24 h-24 rounded-full mx-auto bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span class="text-white text-2xl">👤</span>
              </div>
            {/if}
          </div>
          
          <div class="space-y-2">
            <input
              bind:this={fileInput}
              type="file"
              accept="image/*"
              on:change={handleAvatarChange}
              class="hidden"
              id="avatar-upload"
              disabled={saving || $uploadingAvatar}
            />
            <label
              for="avatar-upload"
              class="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors text-sm disabled:opacity-50"
              class:opacity-50={saving || $uploadingAvatar}
            >
              {$uploadingAvatar ? 'Uploading...' : 'Choose Avatar'}
            </label>
            
            {#if avatarPreview}
              <button
                type="button"
                on:click={removeAvatar}
                class="block mx-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                disabled={saving || $uploadingAvatar}
              >
                Remove
              </button>
            {/if}
          </div>
          
          {#if errors.avatar}
            <p class="text-red-400 text-sm mt-2">{errors.avatar}</p>
          {/if}
        </div>

        <!-- Nickname Field -->
        <div>
          <label for="nickname" class="block text-sm font-medium text-gray-300 mb-2">
            Nickname (Optional)
          </label>
          <div class="relative">
            <input
              id="nickname"
              type="text"
              bind:value={formData.nickname}
              placeholder="Enter a display name"
              class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
              disabled={saving || $uploadingAvatar}
              maxlength="50"
            />
            
            <!-- Nickname availability indicator -->
            <div class="absolute right-3 top-1/2 transform -translate-y-1/2">
              {#if nicknameChecking}
                <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              {:else if formData.nickname && formData.nickname !== ($userProfile?.nickname || '')}
                {#if nicknameAvailable}
                  <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                  </svg>
                {:else}
                  <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                  </svg>
                {/if}
              {/if}
            </div>
          </div>
          
          {#if errors.nickname}
            <p class="text-red-400 text-sm mt-1">{errors.nickname}</p>
          {:else if formData.nickname}
            <p class="text-gray-400 text-xs mt-1">
              Nickname must be unique across all users
            </p>
          {/if}
        </div>


        <!-- Bio Field -->
        <div>
          <label for="bio" class="block text-sm font-medium text-gray-300 mb-2">
            Bio (Optional)
          </label>
          <textarea
            id="bio"
            bind:value={formData.bio}
            placeholder="Tell us about yourself..."
            rows="3"
            class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={saving || $uploadingAvatar}
            maxlength="500"
          ></textarea>
          <div class="flex justify-between items-center mt-1">
            {#if errors.bio}
              <p class="text-red-400 text-sm">{errors.bio}</p>
            {:else}
              <div></div>
            {/if}
            <p class="text-gray-400 text-xs">{formData.bio.length}/500</p>
          </div>
        </div>

        <!-- Notification Settings -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-3">
            Notification Settings
          </label>
          <div class="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-600">
            <div class="flex items-center space-x-3">
              <div class="text-yellow-400">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                </svg>
              </div>
              <div>
                <p class="text-white text-sm font-medium">Push Notifications</p>
                <p class="text-gray-400 text-xs">Get notified about game events and updates</p>
              </div>
            </div>
            <button
              type="button"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 {notificationsToggle ? 'bg-blue-600' : 'bg-gray-600'}"
              disabled={saving || $uploadingAvatar}
              on:click={() => notificationsToggle = !notificationsToggle}
            >
              <span class="sr-only">Toggle notifications</span>
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {notificationsToggle ? 'translate-x-6' : 'translate-x-1'}"
              ></span>
            </button>
          </div>
        </div>

        <!-- Error Display -->
        {#if $profileError}
          <div class="bg-red-900/30 border border-red-500/30 rounded-lg p-3">
            <p class="text-red-300 text-sm">{$profileError}</p>
          </div>
        {/if}

        <!-- Action Buttons -->
        <div class="flex space-x-3 pt-4">
          <button
            type="button"
            on:click={handleClose}
            class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            disabled={saving || $uploadingAvatar}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving || $uploadingAvatar || nicknameChecking || (!nicknameAvailable && formData.nickname !== ($userProfile?.nickname || ''))}
          >
            {#if saving || $uploadingAvatar}
              <div class="flex items-center justify-center space-x-2">
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving...</span>
              </div>
            {:else}
              Save Profile
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  /* Custom scrollbar for the modal */
  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-track {
    background: #374151;
    border-radius: 3px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: #6b7280;
    border-radius: 3px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>