import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import EditProfileLink from '../../src/lib/components/EditProfileLink.svelte';
import { walletAddress } from '../../src/lib/stores/wallet.js';

// Mock the wallet store
vi.mock('../../src/lib/stores/wallet.js', () => ({
  walletAddress: {
    subscribe: vi.fn()
  }
}));

describe('EditProfileLink Component', () => {
  let mockWalletAddress = '0x1234567890123456789012345678901234567890';
  let unsubscribe;

  beforeEach(() => {
    // Mock the wallet address subscription
    unsubscribe = vi.fn();
    walletAddress.subscribe.mockImplementation((callback) => {
      callback(mockWalletAddress);
      return unsubscribe;
    });

    // Mock window.dispatchEvent
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render edit profile button when user is viewing their own profile', () => {
    const { getByRole } = render(EditProfileLink, {
      props: {
        targetWalletAddress: mockWalletAddress
      }
    });

    const button = getByRole('button');
    expect(button).toBeTruthy();
    expect(button.textContent).toContain('Edit Profile');
  });

  it('should not render button when user is viewing someone else\'s profile', () => {
    const { container } = render(EditProfileLink, {
      props: {
        targetWalletAddress: '0x9876543210987654321098765432109876543210'
      }
    });

    const button = container.querySelector('button');
    expect(button).toBeNull();
  });

  it('should dispatch OpenProfileModal event when clicked', async () => {
    const { getByRole } = render(EditProfileLink, {
      props: {
        targetWalletAddress: mockWalletAddress
      }
    });

    const button = getByRole('button');
    await fireEvent.click(button);

    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'OpenProfileModal',
        detail: {
          walletAddress: mockWalletAddress
        }
      })
    );
  });

  it('should handle case-insensitive wallet address comparison', () => {
    const { getByRole } = render(EditProfileLink, {
      props: {
        targetWalletAddress: mockWalletAddress.toUpperCase()
      }
    });

    const button = getByRole('button');
    expect(button).toBeTruthy();
  });

  it('should support custom text and className props', () => {
    const { getByRole } = render(EditProfileLink, {
      props: {
        targetWalletAddress: mockWalletAddress,
        text: 'Custom Text',
        className: 'custom-class'
      }
    });

    const button = getByRole('button');
    expect(button.textContent).toContain('Custom Text');
    expect(button.classList.contains('custom-class')).toBe(true);
  });

  it('should optionally hide icon when showIcon is false', () => {
    const { container } = render(EditProfileLink, {
      props: {
        targetWalletAddress: mockWalletAddress,
        showIcon: false
      }
    });

    const icon = container.querySelector('svg');
    expect(icon).toBeNull();
  });
});