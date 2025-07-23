import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { get } from 'svelte/store';
import { toastStore } from '../../src/lib/stores/toast.js';

describe('Toast Store', () => {
  let clock;

  beforeEach(() => {
    // Use fake timers to control setTimeout behavior
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
    // Clear all toasts
    toastStore.clear();
  });

  describe('Initial State', () => {
    it('should initialize with empty toasts array', () => {
      const state = get(toastStore);
      expect(state).to.be.an('array').that.is.empty;
    });
  });

  describe('Adding Toasts', () => {
    it('should add success toast', () => {
      toastStore.success('Success message');
      
      const state = get(toastStore);
      expect(state).to.have.length(1);
      expect(state[0]).to.deep.include({
        type: 'success',
        message: 'Success message'
      });
      expect(state[0]).to.have.property('id');
      expect(state[0]).to.have.property('timestamp');
    });

    it('should add error toast', () => {
      toastStore.error('Error message');
      
      const state = get(toastStore);
      expect(state).to.have.length(1);
      expect(state[0]).to.deep.include({
        type: 'error',
        message: 'Error message'
      });
    });

    it('should add info toast', () => {
      toastStore.info('Info message');
      
      const state = get(toastStore);
      expect(state).to.have.length(1);
      expect(state[0]).to.deep.include({
        type: 'info',
        message: 'Info message'
      });
    });

    it('should add warning toast', () => {
      toastStore.warning('Warning message');
      
      const state = get(toastStore);
      expect(state).to.have.length(1);
      expect(state[0]).to.deep.include({
        type: 'warning',
        message: 'Warning message'
      });
    });

    it('should generate unique IDs for each toast', () => {
      toastStore.success('First message');
      toastStore.error('Second message');
      
      const state = get(toastStore);
      expect(state).to.have.length(2);
      expect(state[0].id).to.not.equal(state[1].id);
    });

    it('should add timestamp to each toast', () => {
      const beforeTime = Date.now();
      toastStore.info('Test message');
      const afterTime = Date.now();
      
      const state = get(toastStore);
      expect(state[0].timestamp).to.be.at.least(beforeTime);
      expect(state[0].timestamp).to.be.at.most(afterTime);
    });
  });

  describe('Auto-dismiss Functionality', () => {
    it('should auto-dismiss toast after default duration', () => {
      toastStore.success('Auto-dismiss test');
      
      let state = get(toastStore);
      expect(state).to.have.length(1);
      
      // Fast-forward time by default duration (5000ms)
      clock.tick(5000);
      
      state = get(toastStore);
      expect(state).to.be.empty;
    });

    it('should auto-dismiss toast after custom duration', () => {
      toastStore.success('Custom duration test', 3000);
      
      let state = get(toastStore);
      expect(state).to.have.length(1);
      
      // Fast-forward time by less than custom duration
      clock.tick(2000);
      state = get(toastStore);
      expect(state).to.have.length(1);
      
      // Fast-forward time by custom duration
      clock.tick(1000);
      state = get(toastStore);
      expect(state).to.be.empty;
    });

    it('should not auto-dismiss persistent toasts', () => {
      toastStore.error('Persistent error', 0); // 0 duration = persistent
      
      let state = get(toastStore);
      expect(state).to.have.length(1);
      
      // Fast-forward time significantly
      clock.tick(10000);
      
      state = get(toastStore);
      expect(state).to.have.length(1);
    });

    it('should handle multiple toasts with different durations', () => {
      toastStore.success('Short toast', 1000);
      toastStore.info('Medium toast', 3000);
      toastStore.warning('Long toast', 5000);
      
      let state = get(toastStore);
      expect(state).to.have.length(3);
      
      // After 1 second, short toast should be gone
      clock.tick(1000);
      state = get(toastStore);
      expect(state).to.have.length(2);
      
      // After 3 seconds total, medium toast should be gone
      clock.tick(2000);
      state = get(toastStore);
      expect(state).to.have.length(1);
      
      // After 5 seconds total, long toast should be gone
      clock.tick(2000);
      state = get(toastStore);
      expect(state).to.be.empty;
    });
  });

  describe('Manual Dismissal', () => {
    it('should dismiss specific toast by ID', () => {
      toastStore.success('First toast');
      toastStore.error('Second toast');
      
      let state = get(toastStore);
      expect(state).to.have.length(2);
      
      const firstToastId = state[0].id;
      toastStore.dismiss(firstToastId);
      
      state = get(toastStore);
      expect(state).to.have.length(1);
      expect(state[0].message).to.equal('Second toast');
    });

    it('should handle dismissing non-existent toast ID gracefully', () => {
      toastStore.success('Test toast');
      
      let state = get(toastStore);
      expect(state).to.have.length(1);
      
      toastStore.dismiss('non-existent-id');
      
      state = get(toastStore);
      expect(state).to.have.length(1); // Should remain unchanged
    });
  });

  describe('Clear All Toasts', () => {
    it('should clear all toasts', () => {
      toastStore.success('Toast 1');
      toastStore.error('Toast 2');
      toastStore.info('Toast 3');
      
      let state = get(toastStore);
      expect(state).to.have.length(3);
      
      toastStore.clear();
      
      state = get(toastStore);
      expect(state).to.be.empty;
    });

    it('should clear persistent toasts', () => {
      toastStore.error('Persistent toast', 0);
      toastStore.success('Regular toast');
      
      let state = get(toastStore);
      expect(state).to.have.length(2);
      
      toastStore.clear();
      
      state = get(toastStore);
      expect(state).to.be.empty;
    });
  });

  describe('Toast Ordering', () => {
    it('should add new toasts to the beginning of the array', () => {
      toastStore.success('First toast');
      toastStore.error('Second toast');
      toastStore.info('Third toast');
      
      const state = get(toastStore);
      expect(state).to.have.length(3);
      expect(state[0].message).to.equal('Third toast');
      expect(state[1].message).to.equal('Second toast');
      expect(state[2].message).to.equal('First toast');
    });
  });

  describe('Toast Limits', () => {
    it('should limit maximum number of toasts', () => {
      // Add more toasts than the limit (assuming limit is 5)
      for (let i = 1; i <= 10; i++) {
        toastStore.info(`Toast ${i}`);
      }
      
      const state = get(toastStore);
      expect(state.length).to.be.at.most(5); // Assuming max limit is 5
      
      // Should keep the most recent toasts
      expect(state[0].message).to.equal('Toast 10');
      expect(state[4].message).to.equal('Toast 6');
    });
  });

  describe('Toast Types and Styling', () => {
    it('should handle different toast types correctly', () => {
      const types = ['success', 'error', 'info', 'warning'];
      
      types.forEach(type => {
        toastStore[type](`${type} message`);
      });
      
      const state = get(toastStore);
      expect(state).to.have.length(4);
      
      // Check that each toast has the correct type (in reverse order due to prepending)
      expect(state[0].type).to.equal('warning');
      expect(state[1].type).to.equal('info');
      expect(state[2].type).to.equal('error');
      expect(state[3].type).to.equal('success');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message', () => {
      toastStore.success('');
      
      const state = get(toastStore);
      expect(state).to.have.length(1);
      expect(state[0].message).to.equal('');
    });

    it('should handle null message', () => {
      toastStore.success(null);
      
      const state = get(toastStore);
      expect(state).to.have.length(1);
      expect(state[0].message).to.equal(null);
    });

    it('should handle undefined message', () => {
      toastStore.success(undefined);
      
      const state = get(toastStore);
      expect(state).to.have.length(1);
      expect(state[0].message).to.equal(undefined);
    });

    it('should handle negative duration', () => {
      toastStore.success('Negative duration', -1000);
      
      const state = get(toastStore);
      expect(state).to.have.length(1);
      
      // Should treat negative duration as persistent (no auto-dismiss)
      clock.tick(10000);
      const stateAfter = get(toastStore);
      expect(stateAfter).to.have.length(1);
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(1000);
      toastStore.info(longMessage);
      
      const state = get(toastStore);
      expect(state).to.have.length(1);
      expect(state[0].message).to.equal(longMessage);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with many toasts', () => {
      // Add many toasts that auto-dismiss
      for (let i = 0; i < 100; i++) {
        toastStore.success(`Toast ${i}`, 100);
      }
      
      // Fast-forward to dismiss all toasts
      clock.tick(200);
      
      const state = get(toastStore);
      expect(state).to.be.empty;
    });

    it('should clear timeouts when toasts are manually dismissed', () => {
      toastStore.success('Test toast', 5000);
      
      const state = get(toastStore);
      const toastId = state[0].id;
      
      // Manually dismiss before auto-dismiss
      toastStore.dismiss(toastId);
      
      // Fast-forward past auto-dismiss time
      clock.tick(6000);
      
      // Should remain empty (no resurrection of dismissed toast)
      const finalState = get(toastStore);
      expect(finalState).to.be.empty;
    });
  });
});