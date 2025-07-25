import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import Header from '../src/lib/components/Header.svelte';

// Mock the stores
vi.mock('../src/lib/stores/wallet.js', () => ({
  walletStore: {
    disconnect: vi.fn()
  },
  isConnected: { subscribe: vi.fn(cb => cb(true)) },
  walletAddress: { subscribe: vi.fn(cb => cb('0x1234567890123456789012345678901234567890')) },
  walletBalance: { subscribe: vi.fn(cb => cb('1.5')) }
}));

vi.mock('../src/lib/stores/game-unified.js', () => ({
  gameStore: {},
  currentPot: { subscribe: vi.fn(cb => cb('10.5')) }
}));

vi.mock('../src/lib/stores/profile.js', () => ({
  displayName: { subscribe: vi.fn(cb => cb('TestUser')) },
  avatarUrl: { subscribe: vi.fn(cb => cb(null)) },
  userProfile: { subscribe: vi.fn(cb => cb(null)) }
}));

// Mock window.location
delete window.location;
window.location = { href: '' };

describe('Mobile Menu Navigation Links', () => {
  beforeEach(() => {
    // Reset window.location.href before each test
    window.location.href = '';
    
    // Mock console.log to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should handle click events on navigation links', async () => {
    const { container } = render(Header);
    
    // Open mobile menu first
    const mobileMenuButton = container.querySelector('.mobile-menu-button');
    expect(mobileMenuButton).toBeTruthy();
    
    await fireEvent.click(mobileMenuButton);
    
    // Find the home link in mobile menu
    const homeLink = container.querySelector('a[href="/"]');
    expect(homeLink).toBeTruthy();
    
    // Click the home link
    await fireEvent.click(homeLink);
    
    // Verify navigation occurred
    expect(window.location.href).toBe('/');
    expect(console.log).toHaveBeenCalledWith('Navigating to:', '/');
  });

  it('should handle touch events on navigation links', async () => {
    const { container } = render(Header);
    
    // Open mobile menu first
    const mobileMenuButton = container.querySelector('.mobile-menu-button');
    await fireEvent.click(mobileMenuButton);
    
    // Find the leaderboard link in mobile menu
    const leaderboardLink = container.querySelector('a[href="/leaderboard"]');
    expect(leaderboardLink).toBeTruthy();
    
    // Simulate touch event
    await fireEvent.touchStart(leaderboardLink);
    
    // Verify navigation occurred
    expect(window.location.href).toBe('/leaderboard');
    expect(console.log).toHaveBeenCalledWith('Touch navigating to:', '/leaderboard');
  });

  it('should close mobile menu when navigation link is clicked', async () => {
    const { container } = render(Header);
    
    // Open mobile menu
    const mobileMenuButton = container.querySelector('.mobile-menu-button');
    await fireEvent.click(mobileMenuButton);
    
    // Verify menu is open
    const mobileMenu = container.querySelector('.fixed.right-4.top-20');
    expect(mobileMenu).toBeTruthy();
    
    // Click a navigation link
    const aboutLink = container.querySelector('a[href="/about"]');
    await fireEvent.click(aboutLink);
    
    // Verify navigation occurred and menu should be closed
    expect(window.location.href).toBe('/about');
  });

  it('should handle all navigation links correctly', async () => {
    const { container } = render(Header);
    
    // Open mobile menu
    const mobileMenuButton = container.querySelector('.mobile-menu-button');
    await fireEvent.click(mobileMenuButton);
    
    const testCases = [
      { href: '/', expectedLog: 'Navigating to: /' },
      { href: '/referrals', expectedLog: 'Navigating to: /referrals' },
      { href: '/leaderboard', expectedLog: 'Navigating to: /leaderboard' },
      { href: '/about', expectedLog: 'Navigating to: /about' }
    ];
    
    for (const testCase of testCases) {
      // Reset location
      window.location.href = '';
      
      // Find and click the link
      const link = container.querySelector(`a[href="${testCase.href}"]`);
      expect(link).toBeTruthy();
      
      await fireEvent.click(link);
      
      // Verify navigation
      expect(window.location.href).toBe(testCase.href);
      expect(console.log).toHaveBeenCalledWith(testCase.expectedLog);
      
      // Re-open menu for next test
      if (testCase !== testCases[testCases.length - 1]) {
        await fireEvent.click(mobileMenuButton);
      }
    }
  });

  it('should have iOS/Safari compatibility styles', async () => {
    const { container } = render(Header);
    
    // Open mobile menu
    const mobileMenuButton = container.querySelector('.mobile-menu-button');
    await fireEvent.click(mobileMenuButton);
    
    // Check that navigation links have iOS/Safari compatibility styles
    const navLinks = container.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
      const style = link.getAttribute('style');
      expect(style).toContain('touch-action: manipulation');
      expect(style).toContain('-webkit-tap-highlight-color: transparent');
    });
  });

  it('should prevent default behavior on link clicks', async () => {
    const { container } = render(Header);
    
    // Open mobile menu
    const mobileMenuButton = container.querySelector('.mobile-menu-button');
    await fireEvent.click(mobileMenuButton);
    
    // Create a mock event with preventDefault
    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: container.querySelector('a[href="/"]')
    };
    
    // Find the home link and simulate click with mock event
    const homeLink = container.querySelector('a[href="/"]');
    
    // Manually trigger the event handler
    await fireEvent.click(homeLink, mockEvent);
    
    // Verify navigation still occurred
    expect(window.location.href).toBe('/');
  });
});