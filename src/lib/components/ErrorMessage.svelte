<script>
  // Props
  export let gameError = null;
  export let contractDeployed = true;
</script>

{#if gameError}
  <div class="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-center max-w-md">
    <div class="text-red-400 font-semibold mb-2">⚠️ Game Error</div>
    <div class="text-red-300 text-sm">{gameError}</div>
    {#if contractDeployed === false}
      <div class="text-red-200 text-xs mt-2">
        Deploy the smart contract using: <code class="bg-red-800/30 px-1 rounded">pnpm run deploy:testnet</code>
      </div>
    {/if}
  </div>
{/if}