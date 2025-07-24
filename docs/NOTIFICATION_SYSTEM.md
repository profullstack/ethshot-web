# ETH Shot Notification System

## Overview

The ETH Shot notification system is designed to increase user engagement and viral growth by sending browser notifications for key game events. This system helps re-engage users when they're not actively on the site and creates FOMO (Fear of Missing Out) moments that drive viral sharing.

## Features

### 🔔 Notification Types

1. **Jackpot Won** - Notifies when someone wins the jackpot
2. **Cooldown Complete** - Reminds users when they can take another shot
3. **Shot Taken** - Alerts when other players take shots
4. **Pot Milestones** - Celebrates when the pot reaches significant amounts

### 🎯 Viral Engagement Strategy

- **Re-engagement**: Brings users back when their cooldown ends
- **FOMO Creation**: Shows activity from other players
- **Milestone Celebrations**: Creates excitement around growing pot values
- **Social Proof**: Demonstrates active gameplay to encourage participation

## Architecture

### Core Components

```
src/lib/utils/notifications.js     # NotificationManager class
src/lib/stores/game.js            # Integration with game logic
src/lib/components/NotificationPermission.svelte  # UI component
src/routes/+page.svelte           # Main page integration
```

### NotificationManager Class

Located in [`src/lib/utils/notifications.js`](../src/lib/utils/notifications.js)

#### Key Methods

- `isSupported()` - Check if browser supports notifications
- `getPermissionStatus()` - Get current permission state
- `requestPermission()` - Request notification permission from user
- `isEnabled()` - Check if notifications are enabled
- `showNotification(title, options)` - Display a notification
- `scheduleCooldownNotification(endTime)` - Schedule future notification
- `clearCooldownNotification()` - Cancel scheduled notification

#### Notification Methods

- `notifyJackpotWon(amount)` - Show jackpot win notification
- `notifyCooldownComplete()` - Show cooldown complete notification
- `notifyShotTaken(playerAddress)` - Show shot taken notification
- `notifyPotMilestone(amount)` - Show pot milestone notification

### Game Store Integration

The notification system is integrated into [`src/lib/stores/game.js`](../src/lib/stores/game.js):

```javascript
// Notification triggers
- Jackpot wins → notifyJackpotWon()
- Shot taken → notifyShotTaken() + scheduleCooldownNotification()
- Pot milestones → notifyPotMilestone()
- Real-time updates → notifications for other players' actions
```

### UI Component

[`src/lib/components/NotificationPermission.svelte`](../src/lib/components/NotificationPermission.svelte) provides:

- Permission request prompt
- Status indicator
- User-friendly permission management
- Responsive design for mobile/desktop

## Implementation Details

### Permission Handling

```javascript
// Check support
if (!notificationManager.isSupported()) {
  // Fallback behavior
}

// Request permission
const granted = await notificationManager.requestPermission();
if (granted) {
  // Enable notifications
}
```

### Notification Scheduling

```javascript
// Schedule notification for when cooldown ends
const cooldownEndTime = Date.now() + (cooldownSeconds * 1000);
const timeoutId = notificationManager.scheduleCooldownNotification(cooldownEndTime);

// Clear if user takes action before cooldown ends
notificationManager.clearCooldownNotification();
```

### Real-time Integration

```javascript
// Listen for real-time game events
supabase
  .channel('game_events')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shots' }, (payload) => {
    // Notify about other players' shots
    notificationManager.notifyShotTaken(payload.new.player_address);
  })
  .subscribe();
```

## Browser Compatibility

### Supported Browsers
- ✅ Chrome 50+
- ✅ Firefox 44+
- ✅ Safari 16+
- ✅ Edge 79+

### Mobile Support
- ✅ Chrome Mobile
- ✅ Firefox Mobile
- ⚠️ Safari Mobile (limited - requires user interaction)
- ❌ iOS WebView (notifications not supported in webviews)

### Webview Detection

The system includes webview detection to avoid showing notification prompts in environments where they won't work:

```javascript
import { isIOSDevice, isInWebview } from '../utils/external-links.js';

// Don't show notification prompt in webviews
if (isIOSDevice() && isInWebview()) {
  // Skip notification setup
}
```

## Testing

### Unit Tests

Comprehensive test suite in [`test/utils/notifications.test.js`](../test/utils/notifications.test.js):

- Permission handling
- Notification creation
- Scheduling functionality
- Error handling
- Edge cases

### Manual Testing

Browser test page at [`test/manual-notification-test.html`](../test/manual-notification-test.html):

- Permission request testing
- All notification types
- Scheduled notifications
- Real-time status updates

### Running Tests

```bash
# Run unit tests
pnpm test test/utils/notifications.test.js

# Manual browser testing
# Open test/manual-notification-test.html in browser
# Or serve via development server
```

## Configuration

### Notification Content

Notifications are configured with:
- **Icons**: Uses favicon for brand consistency
- **Titles**: Clear, action-oriented messages
- **Bodies**: Specific details about the event
- **Click Actions**: Can redirect to game page

### Timing

- **Cooldown notifications**: Scheduled based on game cooldown period
- **Milestone notifications**: Triggered at configurable pot amounts
- **Real-time notifications**: Immediate for shots and wins

## Privacy & Permissions

### Permission States

1. **Default**: User hasn't been asked yet
2. **Granted**: User has allowed notifications
3. **Denied**: User has blocked notifications

### User Control

- Users can enable/disable at any time
- Browser settings override application settings
- Graceful degradation when notifications unavailable

### Data Usage

- No personal data stored for notifications
- Only game state used (pot amounts, addresses)
- No tracking or analytics on notification interactions

## Performance Considerations

### Memory Management

- Automatic cleanup of scheduled timeouts
- Event listener management
- Proper component lifecycle handling

### Network Usage

- Notifications use cached data when possible
- Minimal API calls for notification content
- Real-time subscriptions optimized for efficiency

## Future Enhancements

### Planned Features

1. **Notification Preferences**: User-configurable notification types
2. **Sound Notifications**: Audio alerts for important events
3. **Rich Notifications**: Images and action buttons
4. **Push Notifications**: Server-sent notifications for offline users
5. **Notification History**: Log of recent notifications

### Analytics Integration

- Track notification engagement rates
- A/B test notification content
- Measure impact on user retention
- Optimize notification timing

## Troubleshooting

### Common Issues

1. **Notifications not appearing**
   - Check browser permissions
   - Verify notification support
   - Check console for errors

2. **Permission denied**
   - Guide users to browser settings
   - Provide alternative engagement methods
   - Respect user choice

3. **Scheduled notifications not firing**
   - Verify timeout scheduling
   - Check for page visibility issues
   - Ensure proper cleanup

### Debug Mode

Enable debug logging:

```javascript
// Add to browser console
localStorage.setItem('debug-notifications', 'true');
```

## Security Considerations

### Content Safety

- All notification content is sanitized
- No user-generated content in notifications
- Addresses are truncated for privacy

### Permission Abuse Prevention

- Single permission request per session
- Graceful handling of denied permissions
- No persistent prompting

## Conclusion

The ETH Shot notification system provides a comprehensive solution for user re-engagement and viral growth. By leveraging browser notifications strategically, the system creates multiple touchpoints that bring users back to the game and encourage continued participation.

The implementation follows web standards, includes comprehensive testing, and provides graceful fallbacks for unsupported environments. This ensures a consistent user experience across all platforms while maximizing engagement opportunities.