import { expect } from 'chai';
import { render, screen, fireEvent } from '@testing-library/svelte';
import GameButton from '../../src/lib/components/GameButton.svelte';

describe('GameButton Component', () => {
  beforeEach(() => {
    // Mock the stores
    global.gameStore = {
      getGameState: () => ({
        loading: false,
        takingShot: false,
        canShoot: true,
        cooldownRemaining: 0,
        currentPot: '1.0',
        contractDeployed: true,
        error: null
      })
    };
    
    global.walletStore = {
      connect: () => {},
      switchNetwork: () => {},
      get: () => ({
        connected: true,
        address: '0x1234567890123456789012345678901234567890',
        network: 'correct'
      })
    };
    
    global.toastStore = {
      error: () => {},
      success: () => {},
      info: () => {}
    };
    
    global.debugMode = {
      subscribe: () => {}
    };
  });

  it('should show spinner and loading message when taking shot', () => {
    // Mock the game store to show loading state
    global.gameStore.getGameState = () => ({
      loading: false,
      takingShot: true,
      canShoot: false,
      cooldownRemaining: 0,
      currentPot: '1.0',
      contractDeployed: true,
      error: null
    });

    render(GameButton);
    
    // Check if spinner is present
    const spinner = screen.querySelector('.spinner');
    expect(spinner).to.exist;
    
    // Check if loading message is shown
    const loadingText = screen.getByText('Processing your shot...');
    expect(loadingText).to.exist;
  });

  it('should show status bar when loading', () => {
    // Mock the game store to show loading state
    global.gameStore.getGameState = () => ({
      loading: true,
      takingShot: false,
      canShoot: false,
      cooldownRemaining: 0,
      currentPot: '1.0',
      contractDeployed: true,
      error: null
    });

    render(GameButton);
    
    // Check if status bar container is present
    const statusBarContainer = screen.querySelector('.status-bar-container');
    expect(statusBarContainer).to.exist;
    
    // Check if status bar is present
    const statusBar = screen.querySelector('.status-bar');
    expect(statusBar).to.exist;
    
    // Check if status message is shown
    const statusMessage = screen.getByText('Loading game data...');
    expect(statusMessage).to.exist;
  });

  it('should show cooldown status bar when in cooldown', () => {
    // Mock the game store to show cooldown state
    global.gameStore.getGameState = () => ({
      loading: false,
      takingShot: false,
      canShoot: false,
      cooldownRemaining: 300, // 5 minutes
      currentPot: '1.0',
      contractDeployed: true,
      error: null
    });

    render(GameButton);
    
    // Check if cooldown status bar is present
    const cooldownBar = screen.querySelector('.cooldown-bar');
    expect(cooldownBar).to.exist;
    
    // Check if cooldown message is shown
    const cooldownMessage = screen.getByText('Cooldown Active');
    expect(cooldownMessage).to.exist;
  });

  it('should show regular shot button when ready', () => {
    // Mock the game store to show ready state
    global.gameStore.getGameState = () => ({
      loading: false,
      takingShot: false,
      canShoot: true,
      cooldownRemaining: 0,
      currentPot: '1.0',
      contractDeployed: true,
      error: null
    });

    render(GameButton);
    
    // Check if regular shot button is present
    const shotButton = screen.getByText('🎯 TAKE SHOT');
    expect(shotButton).to.exist;
    
    // Check if pulse effect is present
    const pulseEffect = screen.querySelector('.animate-ping');
    expect(pulseEffect).to.exist;
  });

  it('should show first shot button when pot is empty', () => {
    // Mock the game store to show first shot state
    global.gameStore.getGameState = () => ({
      loading: false,
      takingShot: false,
      canShoot: true,
      cooldownRemaining: 0,
      currentPot: '0',
      contractDeployed: true,
      error: null
    });

    render(GameButton);
    
    // Check if first shot button is present
    const firstShotButton = screen.getByText('🚀 TAKE THE FIRST SHOT');
    expect(firstShotButton).to.exist;
  });
});