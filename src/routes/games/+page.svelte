<script>
	import MetaTags from '$lib/components/MetaTags.svelte';
</script>

<MetaTags 
	title="Games - ETH Shot"
	description="Discover upcoming Ethereum jackpot games - ETH Roulette, Progressive Slots, Crash Game, FOMO Jackpot and more coming soon!"
	keywords="ethereum games, crypto gambling, eth jackpot, progressive slots, crash game, fomo jackpot, blockchain gaming, smart contracts"
/>

<div class="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
	<div class="container mx-auto px-4 py-12">
		<!-- Header Section -->
		<div class="text-center mb-16">
			<h1 class="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
				Coming Soon Games
			</h1>
			<p class="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
				Get ready for an exciting collection of Ethereum-powered jackpot games! 
				Provably fair, smart contract-based gaming with massive ETH prizes.
			</p>
		</div>

		<!-- Games Grid -->
		<div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
			<!-- ETH Jackpot Roulette -->
			<div class="group relative">
				<div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-green-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
					<!-- Coming Soon Badge -->
					<div class="absolute -top-3 -right-3 bg-gradient-to-r from-green-400 to-emerald-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
						Coming Soon
					</div>
					
					<!-- Game Icon -->
					<div class="flex justify-center mb-6">
						<div class="w-24 h-24 bg-gradient-to-br from-white to-gray-200 rounded-2xl p-4 shadow-lg group-hover:shadow-green-500/20 transition-all duration-300 flex items-center justify-center">
							<span class="text-4xl">🎯</span>
						</div>
					</div>
					
					<!-- Game Info -->
					<h3 class="text-2xl font-bold text-center mb-4 text-green-400">ETH Jackpot Roulette</h3>
					<p class="text-gray-300 text-center mb-6 leading-relaxed">
						Bet ETH on roulette numbers. Smart contract picks the winner. Winner takes all the ETH pot!
					</p>
					
					<!-- Features -->
					<div class="space-y-2 mb-6">
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
							Winner takes all pot
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
							Smart contract randomness
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
							Provably fair results
						</div>
					</div>
					
					<!-- Notify Button -->
					<button class="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg">
						Notify Me
					</button>
				</div>
			</div>

			<!-- Progressive Jackpot Slots -->
			<div class="group relative">
				<div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-red-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
					<!-- Coming Soon Badge -->
					<div class="absolute -top-3 -right-3 bg-gradient-to-r from-red-400 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
						Coming Soon
					</div>
					
					<!-- Game Icon -->
					<div class="flex justify-center mb-6">
						<div class="w-24 h-24 bg-gradient-to-br from-white to-gray-200 rounded-2xl p-4 shadow-lg group-hover:shadow-red-500/20 transition-all duration-300">
							<img src="/icons/slot-machine.svg" alt="Progressive Slots" class="w-full h-full" />
						</div>
					</div>
					
					<!-- Game Info -->
					<h3 class="text-2xl font-bold text-center mb-4 text-red-400">Progressive Jackpot Slots</h3>
					<p class="text-gray-300 text-center mb-6 leading-relaxed">
						Slot machine with growing ETH jackpot. Each spin adds to the pot until someone hits the winning combo!
					</p>
					
					<!-- Features -->
					<div class="space-y-2 mb-6">
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
							Growing ETH jackpot
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
							Provably fair spins
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
							Massive payouts
						</div>
					</div>
					
					<!-- Notify Button -->
					<button class="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg">
						Notify Me
					</button>
				</div>
			</div>

			<!-- ETH Crash Game -->
			<div class="group relative">
				<div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-orange-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
					<!-- Coming Soon Badge -->
					<div class="absolute -top-3 -right-3 bg-gradient-to-r from-orange-400 to-red-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
						Coming Soon
					</div>
					
					<!-- Game Icon -->
					<div class="flex justify-center mb-6">
						<div class="w-24 h-24 bg-gradient-to-br from-white to-gray-200 rounded-2xl p-4 shadow-lg group-hover:shadow-orange-500/20 transition-all duration-300 flex items-center justify-center">
							<span class="text-4xl">📈</span>
						</div>
					</div>
					
					<!-- Game Info -->
					<h3 class="text-2xl font-bold text-center mb-4 text-orange-400">ETH Crash Game</h3>
					<p class="text-gray-300 text-center mb-6 leading-relaxed">
						Watch the multiplier grow! Cash out before it crashes. Hit rare jackpot multipliers for huge ETH rewards.
					</p>
					
					<!-- Features -->
					<div class="space-y-2 mb-6">
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-orange-500 rounded-full mr-3"></div>
							Growing multipliers
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-orange-500 rounded-full mr-3"></div>
							Jackpot multiplier bonus
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-orange-500 rounded-full mr-3"></div>
							Instant cashouts
						</div>
					</div>
					
					<!-- Notify Button -->
					<button class="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg">
						Notify Me
					</button>
				</div>
			</div>

			<!-- ETH Dice Jackpot -->
			<div class="group relative">
				<div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-yellow-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
					<!-- Coming Soon Badge -->
					<div class="absolute -top-3 -right-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-4 py-1 rounded-full text-sm font-bold shadow-lg">
						Coming Soon
					</div>
					
					<!-- Game Icon -->
					<div class="flex justify-center mb-6">
						<div class="w-24 h-24 bg-gradient-to-br from-white to-gray-200 rounded-2xl p-4 shadow-lg group-hover:shadow-yellow-500/20 transition-all duration-300">
							<img src="/icons/dice.svg" alt="ETH Dice" class="w-full h-full" />
						</div>
					</div>
					
					<!-- Game Info -->
					<h3 class="text-2xl font-bold text-center mb-4 text-yellow-400">ETH Dice Jackpot</h3>
					<p class="text-gray-300 text-center mb-6 leading-relaxed">
						Roll dice and bet ETH against odds. Hit rare perfect combinations to trigger massive jackpot payouts!
					</p>
					
					<!-- Features -->
					<div class="space-y-2 mb-6">
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
							Perfect roll jackpots
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
							Multiple betting options
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
							Blockchain randomness
						</div>
					</div>
					
					<!-- Notify Button -->
					<button class="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg">
						Notify Me
					</button>
				</div>
			</div>

			<!-- FOMO Jackpot -->
			<div class="group relative">
				<div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-purple-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
					<!-- Coming Soon Badge -->
					<div class="absolute -top-3 -right-3 bg-gradient-to-r from-purple-400 to-indigo-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
						Coming Soon
					</div>
					
					<!-- Game Icon -->
					<div class="flex justify-center mb-6">
						<div class="w-24 h-24 bg-gradient-to-br from-white to-gray-200 rounded-2xl p-4 shadow-lg group-hover:shadow-purple-500/20 transition-all duration-300 flex items-center justify-center">
							<span class="text-4xl">⏰</span>
						</div>
					</div>
					
					<!-- Game Info -->
					<h3 class="text-2xl font-bold text-center mb-4 text-purple-400">FOMO Jackpot</h3>
					<p class="text-gray-300 text-center mb-6 leading-relaxed">
						Buy keys to extend the timer! Last person to buy when timer hits zero wins the massive ETH jackpot.
					</p>
					
					<!-- Features -->
					<div class="space-y-2 mb-6">
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
							Timer-based gameplay
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
							Last player wins all
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
							Massive ETH prizes
						</div>
					</div>
					
					<!-- Notify Button -->
					<button class="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg">
						Notify Me
					</button>
				</div>
			</div>

			<!-- Ethereum Lottery -->
			<div class="group relative">
				<div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-blue-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
					<!-- Coming Soon Badge -->
					<div class="absolute -top-3 -right-3 bg-gradient-to-r from-blue-400 to-cyan-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
						Coming Soon
					</div>
					
					<!-- Game Icon -->
					<div class="flex justify-center mb-6">
						<div class="w-24 h-24 bg-gradient-to-br from-white to-gray-200 rounded-2xl p-4 shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300 flex items-center justify-center">
							<span class="text-4xl">🎫</span>
						</div>
					</div>
					
					<!-- Game Info -->
					<h3 class="text-2xl font-bold text-center mb-4 text-blue-400">Ethereum Lottery</h3>
					<p class="text-gray-300 text-center mb-6 leading-relaxed">
						Buy lottery tickets with ETH. Smart contract randomly picks winners. Larger jackpots attract more players!
					</p>
					
					<!-- Features -->
					<div class="space-y-2 mb-6">
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
							Periodic drawings
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
							Growing prize pools
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
							Multiple ticket options
						</div>
					</div>
					
					<!-- Notify Button -->
					<button class="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg">
						Notify Me
					</button>
				</div>
			</div>

			<!-- ETH Bingo -->
			<div class="group relative">
				<div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-teal-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
					<!-- Coming Soon Badge -->
					<div class="absolute -top-3 -right-3 bg-gradient-to-r from-teal-400 to-green-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
						Coming Soon
					</div>
					
					<!-- Game Icon -->
					<div class="flex justify-center mb-6">
						<div class="w-24 h-24 bg-gradient-to-br from-white to-gray-200 rounded-2xl p-4 shadow-lg group-hover:shadow-teal-500/20 transition-all duration-300 flex items-center justify-center">
							<span class="text-4xl">🎱</span>
						</div>
					</div>
					
					<!-- Game Info -->
					<h3 class="text-2xl font-bold text-center mb-4 text-teal-400">ETH Bingo</h3>
					<p class="text-gray-300 text-center mb-6 leading-relaxed">
						Buy digital bingo cards with ETH. Smart contract draws numbers until someone hits BINGO and wins the jackpot!
					</p>
					
					<!-- Features -->
					<div class="space-y-2 mb-6">
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-teal-500 rounded-full mr-3"></div>
							Digital bingo cards
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-teal-500 rounded-full mr-3"></div>
							Rare pattern bonuses
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-teal-500 rounded-full mr-3"></div>
							Automated drawings
						</div>
					</div>
					
					<!-- Notify Button -->
					<button class="w-full bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-400 hover:to-green-400 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg">
						Notify Me
					</button>
				</div>
			</div>

			<!-- ETH Coin Flip -->
			<div class="group relative">
				<div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-pink-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
					<!-- Coming Soon Badge -->
					<div class="absolute -top-3 -right-3 bg-gradient-to-r from-pink-400 to-rose-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
						Coming Soon
					</div>
					
					<!-- Game Icon -->
					<div class="flex justify-center mb-6">
						<div class="w-24 h-24 bg-gradient-to-br from-white to-gray-200 rounded-2xl p-4 shadow-lg group-hover:shadow-pink-500/20 transition-all duration-300 flex items-center justify-center">
							<span class="text-4xl">🪙</span>
						</div>
					</div>
					
					<!-- Game Info -->
					<h3 class="text-2xl font-bold text-center mb-4 text-pink-400">ETH Coin Flip</h3>
					<p class="text-gray-300 text-center mb-6 leading-relaxed">
						Simple heads or tails with ETH bets. Hit consecutive wins to trigger rare jackpot bonuses!
					</p>
					
					<!-- Features -->
					<div class="space-y-2 mb-6">
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-pink-500 rounded-full mr-3"></div>
							Heads or tails betting
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-pink-500 rounded-full mr-3"></div>
							Consecutive win bonuses
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-pink-500 rounded-full mr-3"></div>
							Provably fair flips
						</div>
					</div>
					
					<!-- Notify Button -->
					<button class="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg">
						Notify Me
					</button>
				</div>
			</div>
		</div>

		<!-- Call to Action Section -->
		<div class="text-center mt-16">
			<div class="bg-gradient-to-r from-purple-800/50 to-blue-800/50 rounded-2xl p-8 border border-purple-500/30 max-w-4xl mx-auto">
				<h2 class="text-3xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
					Powered by Smart Contracts
				</h2>
				<p class="text-gray-300 mb-6 text-lg">
					All games use Ethereum smart contracts for transparency, provable fairness, and automatic payouts. No house edge - just pure jackpot excitement!
				</p>
				<div class="flex flex-col sm:flex-row gap-4 justify-center">
					<a href="/" class="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg">
						Play ETH Shot Now
					</a>
					<a href="/about" class="border border-purple-500 hover:bg-purple-500/20 text-purple-300 hover:text-white font-bold py-3 px-8 rounded-xl transition-all duration-300">
						Learn More
					</a>
				</div>
			</div>
		</div>

		<!-- Development Timeline -->
		<div class="mt-16">
			<h2 class="text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
				Development Timeline
			</h2>
			<div class="max-w-2xl mx-auto">
				<div class="space-y-4">
					<div class="flex items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
						<div class="w-4 h-4 bg-green-500 rounded-full mr-4"></div>
						<div>
							<h4 class="font-bold text-green-400">ETH Shot Live</h4>
							<p class="text-gray-400 text-sm">The original jackpot game is live and ready to play!</p>
						</div>
					</div>
					<div class="flex items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
						<div class="w-4 h-4 bg-yellow-500 rounded-full mr-4"></div>
						<div>
							<h4 class="font-bold text-yellow-400">Q2 2025 - ETH Roulette & Dice Jackpot</h4>
							<p class="text-gray-400 text-sm">Classic games with winner-takes-all ETH jackpots</p>
						</div>
					</div>
					<div class="flex items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
						<div class="w-4 h-4 bg-red-500 rounded-full mr-4"></div>
						<div>
							<h4 class="font-bold text-red-400">Q3 2025 - Progressive Slots & Crash Game</h4>
							<p class="text-gray-400 text-sm">Growing jackpots and multiplier-based gameplay</p>
						</div>
					</div>
					<div class="flex items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
						<div class="w-4 h-4 bg-purple-500 rounded-full mr-4"></div>
						<div>
							<h4 class="font-bold text-purple-400">Q4 2025 - FOMO Jackpot & Lottery</h4>
							<p class="text-gray-400 text-sm">Timer-based games and periodic lottery drawings</p>
						</div>
					</div>
					<div class="flex items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
						<div class="w-4 h-4 bg-blue-500 rounded-full mr-4"></div>
						<div>
							<h4 class="font-bold text-blue-400">Q1 2026 - Bingo & Coin Flip</h4>
							<p class="text-gray-400 text-sm">Community games and streak-based jackpot bonuses</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>