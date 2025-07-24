import { expect } from 'chai';
import { NotificationManager } from '../../src/lib/utils/notifications.js';

// Mock the Notification API
global.Notification = class MockNotification {
  constructor(title, options) {
    this.title = title;
    this.options = options;
    this.onclick = null;
    this.onshow = null;
    this.onclose = null;
    this.onerror = null;
    
    // Simulate notification display
    setTimeout(() => {
      if (this.onshow) this.onshow();
    }, 0);
  }
  
  close() {
    if (this.onclose) this.onclose();
  }
  
  static permission = 'default';
  
  static requestPermission() {
    return Promise.resolve(MockNotification.permission);
  }
};

describe('NotificationManager', () => {
  let notificationManager;
  
  beforeEach(() => {
    notificationManager = new NotificationManager();
    global.Notification.permission = 'default';
  });
  
  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      expect(notificationManager.isSupported()).to.be.true;
      expect(notificationManager.isEnabled()).to.be.false;
    });
  });
  
  describe('isSupported', () => {
    it('should return true when Notification API is available', () => {
      expect(notificationManager.isSupported()).to.be.true;
    });
    
    it('should return false when Notification API is not available', () => {
      const originalNotification = global.Notification;
      delete global.Notification;
      
      const manager = new NotificationManager();
      expect(manager.isSupported()).to.be.false;
      
      global.Notification = originalNotification;
    });
  });
  
  describe('getPermissionStatus', () => {
    it('should return current permission status', () => {
      global.Notification.permission = 'granted';
      expect(notificationManager.getPermissionStatus()).to.equal('granted');
      
      global.Notification.permission = 'denied';
      expect(notificationManager.getPermissionStatus()).to.equal('denied');
      
      global.Notification.permission = 'default';
      expect(notificationManager.getPermissionStatus()).to.equal('default');
    });
  });
  
  describe('isEnabled', () => {
    it('should return true when permission is granted', () => {
      global.Notification.permission = 'granted';
      expect(notificationManager.isEnabled()).to.be.true;
    });
    
    it('should return false when permission is denied', () => {
      global.Notification.permission = 'denied';
      expect(notificationManager.isEnabled()).to.be.false;
    });
    
    it('should return false when permission is default', () => {
      global.Notification.permission = 'default';
      expect(notificationManager.isEnabled()).to.be.false;
    });
  });
  
  describe('requestPermission', () => {
    it('should request permission and return true when granted', async () => {
      global.Notification.permission = 'granted';
      global.Notification.requestPermission = () => Promise.resolve('granted');
      
      const result = await notificationManager.requestPermission();
      expect(result).to.be.true;
    });
    
    it('should request permission and return false when denied', async () => {
      global.Notification.permission = 'denied';
      global.Notification.requestPermission = () => Promise.resolve('denied');
      
      const result = await notificationManager.requestPermission();
      expect(result).to.be.false;
    });
    
    it('should return false when notifications are not supported', async () => {
      const originalNotification = global.Notification;
      delete global.Notification;
      
      const manager = new NotificationManager();
      const result = await manager.requestPermission();
      expect(result).to.be.false;
      
      global.Notification = originalNotification;
    });
  });
  
  describe('showNotification', () => {
    beforeEach(() => {
      global.Notification.permission = 'granted';
    });
    
    it('should show notification with correct title and options', () => {
      const title = 'Test Notification';
      const options = {
        body: 'Test body',
        icon: '/test-icon.png'
      };
      
      const notification = notificationManager.showNotification(title, options);
      expect(notification.title).to.equal(title);
      expect(notification.options).to.deep.equal(options);
    });
    
    it('should return null when notifications are not enabled', () => {
      global.Notification.permission = 'denied';
      
      const notification = notificationManager.showNotification('Test', {});
      expect(notification).to.be.null;
    });
    
    it('should return null when notifications are not supported', () => {
      const originalNotification = global.Notification;
      delete global.Notification;
      
      const manager = new NotificationManager();
      const notification = manager.showNotification('Test', {});
      expect(notification).to.be.null;
      
      global.Notification = originalNotification;
    });
  });
  
  describe('notifyJackpotWon', () => {
    beforeEach(() => {
      global.Notification.permission = 'granted';
    });
    
    it('should show jackpot notification with correct content', () => {
      const amount = '5.25';
      const notification = notificationManager.notifyJackpotWon(amount);
      
      expect(notification.title).to.equal('🎉 JACKPOT WON!');
      expect(notification.options.body).to.equal(`Someone just won ${amount} ETH! The pot has been reset.`);
      expect(notification.options.icon).to.include('favicon');
    });
  });
  
  describe('notifyCooldownComplete', () => {
    beforeEach(() => {
      global.Notification.permission = 'granted';
    });
    
    it('should show cooldown complete notification', () => {
      const notification = notificationManager.notifyCooldownComplete();
      
      expect(notification.title).to.equal('⏰ Ready to Play!');
      expect(notification.options.body).to.equal('Your cooldown period is over. Take another shot at the ETH jackpot!');
      expect(notification.options.icon).to.include('favicon');
    });
  });
  
  describe('notifyShotTaken', () => {
    beforeEach(() => {
      global.Notification.permission = 'granted';
    });
    
    it('should show shot taken notification with player address', () => {
      const player = '0x1234567890123456789012345678901234567890';
      const notification = notificationManager.notifyShotTaken(player);
      
      expect(notification.title).to.equal('🎯 New Shot Taken!');
      expect(notification.options.body).to.equal(`${player.slice(0, 6)}...${player.slice(-4)} just took a shot! Will they win?`);
      expect(notification.options.icon).to.include('favicon');
    });
    
    it('should handle short addresses gracefully', () => {
      const player = '0x123';
      const notification = notificationManager.notifyShotTaken(player);
      
      expect(notification.options.body).to.equal(`${player} just took a shot! Will they win?`);
    });
  });
  
  describe('notifyPotMilestone', () => {
    beforeEach(() => {
      global.Notification.permission = 'granted';
    });
    
    it('should show pot milestone notification', () => {
      const amount = '10.0';
      const notification = notificationManager.notifyPotMilestone(amount);
      
      expect(notification.title).to.equal('💰 Pot Milestone!');
      expect(notification.options.body).to.equal(`The jackpot has reached ${amount} ETH! Take your shot now!`);
      expect(notification.options.icon).to.include('favicon');
    });
  });
  
  describe('scheduleCooldownNotification', () => {
    beforeEach(() => {
      global.Notification.permission = 'granted';
    });
    
    it('should schedule notification for future time', () => {
      const cooldownEndTime = Date.now() + 1000; // 1 second from now
      const timeoutId = notificationManager.scheduleCooldownNotification(cooldownEndTime);
      
      expect(timeoutId).to.be.a('number');
      expect(timeoutId).to.be.greaterThan(0);
      
      // Clean up
      clearTimeout(timeoutId);
    });
    
    it('should not schedule notification for past time', () => {
      const pastTime = Date.now() - 1000; // 1 second ago
      const timeoutId = notificationManager.scheduleCooldownNotification(pastTime);
      
      expect(timeoutId).to.be.null;
    });
    
    it('should not schedule when notifications are disabled', () => {
      global.Notification.permission = 'denied';
      
      const futureTime = Date.now() + 1000;
      const timeoutId = notificationManager.scheduleCooldownNotification(futureTime);
      
      expect(timeoutId).to.be.null;
    });
  });
  
  describe('clearCooldownNotification', () => {
    it('should clear existing timeout', () => {
      const cooldownEndTime = Date.now() + 5000; // 5 seconds from now
      const timeoutId = notificationManager.scheduleCooldownNotification(cooldownEndTime);
      
      expect(timeoutId).to.be.a('number');
      
      notificationManager.clearCooldownNotification();
      
      // The timeout should be cleared (we can't directly test this, but no error should occur)
      expect(() => notificationManager.clearCooldownNotification()).to.not.throw();
    });
    
    it('should handle clearing when no timeout exists', () => {
      expect(() => notificationManager.clearCooldownNotification()).to.not.throw();
    });
  });
  
  describe('edge cases', () => {
    it('should handle notification creation errors gracefully', () => {
      global.Notification.permission = 'granted';
      
      // Mock Notification constructor to throw error
      const originalNotification = global.Notification;
      global.Notification = function() {
        throw new Error('Notification creation failed');
      };
      global.Notification.permission = 'granted';
      
      const notification = notificationManager.showNotification('Test', {});
      expect(notification).to.be.null;
      
      global.Notification = originalNotification;
    });
    
    it('should handle permission request errors gracefully', async () => {
      global.Notification.requestPermission = () => Promise.reject(new Error('Permission request failed'));
      
      const result = await notificationManager.requestPermission();
      expect(result).to.be.false;
    });
  });
});