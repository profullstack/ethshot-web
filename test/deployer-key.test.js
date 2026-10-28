import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { accountsFor, deployerKey, selectedNetwork } from '../scripts/lib/deployer-key.js';

describe('deployer key (never from env)', () => {
  afterEach(() => {
    delete process.env.PRIVATE_KEY;
  });

  it('does not ask for a key when no live network is selected', () => {
    expect(accountsFor('sepolia')).to.deep.equal([]);
  });

  it('reads the selected network from --network or HARDHAT_NETWORK', () => {
    expect(selectedNetwork(['node', 'hardhat', 'run', 'x.js', '--network', 'base'], {})).to.equal('base');
    expect(selectedNetwork([], { HARDHAT_NETWORK: 'mainnet' })).to.equal('mainnet');
  });

  it('refuses a PRIVATE_KEY left in the environment', () => {
    process.env.PRIVATE_KEY = `0x${'1'.repeat(64)}`;
    expect(() => deployerKey()).to.throw(/no longer read/);
  });
});
