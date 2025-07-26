<script>
	import MetaTags from '$lib/components/MetaTags.svelte';
</script>

<MetaTags 
	title="Games - ETH Shot"
	description="Discover upcoming games on ETH Shot - Dice Roll, Spin Wheel, and Slot Machine coming soon!"
	keywords="ethereum games, crypto gambling, dice roll, spin wheel, slot machine, blockchain gaming"
/>

<div class="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
	<div class="container mx-auto px-4 py-12">
		<!-- Header Section -->
		<div class="text-center mb-16">
			<h1 class="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
				Coming Soon Games
			</h1>
			<p class="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
				Get ready for an exciting collection of blockchain-powered games! 
				More ways to win big are coming to ETH Shot.
			</p>
		</div>

		<!-- Games Grid -->
		<div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
			<!-- Dice Roll Game -->
			<div class="group relative">
				<div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-yellow-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
					<!-- Coming Soon Badge -->
					<div class="absolute -top-3 -right-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-4 py-1 rounded-full text-sm font-bold shadow-lg">
						Coming Soon
					</div>
					
					<!-- Game Icon -->
					<div class="flex justify-center mb-6">
						<div class="w-24 h-24 bg-gradient-to-br from-white to-gray-200 rounded-2xl p-4 shadow-lg group-hover:shadow-yellow-500/20 transition-all duration-300">
							<img src="/icons/dice.svg" alt="Dice Roll" class="w-full h-full" />
						</div>
					</div>
					
					<!-- Game Info -->
					<h3 class="text-2xl font-bold text-center mb-4 text-yellow-400">Dice Roll</h3>
					<p class="text-gray-300 text-center mb-6 leading-relaxed">
						Roll the dice and predict the outcome! Choose your numbers and multiply your winnings with this classic game of chance.
					</p>
					
					<!-- Features -->
					<div class="space-y-2 mb-6">
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
							Multiple betting options
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
							High payout multipliers
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
							Provably fair results
						</div>
					</div>
					
					<!-- Notify Button -->
					<button class="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg">
						Notify Me
					</button>
				</div>
			</div>

			<!-- Spin Wheel Game -->
			<div class="group relative">
				<div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-blue-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
					<!-- Coming Soon Badge -->
					<div class="absolute -top-3 -right-3 bg-gradient-to-r from-blue-400 to-purple-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
						Coming Soon
					</div>
					
					<!-- Game Icon -->
					<div class="flex justify-center mb-6">
						<div class="w-24 h-24 bg-gradient-to-br from-white to-gray-200 rounded-2xl p-4 shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300">
							<img src="/icons/spin.svg" alt="Spin Wheel" class="w-full h-full" />
						</div>
					</div>
					
					<!-- Game Info -->
					<h3 class="text-2xl font-bold text-center mb-4 text-blue-400">Spin Wheel</h3>
					<p class="text-gray-300 text-center mb-6 leading-relaxed">
						Spin the colorful wheel of fortune! Place your bets on colors, numbers, or sections for exciting multiplier wins.
					</p>
					
					<!-- Features -->
					<div class="space-y-2 mb-6">
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
							Colorful betting options
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
							Animated wheel spins
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
							Multiple win conditions
						</div>
					</div>
					
					<!-- Notify Button -->
					<button class="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg">
						Notify Me
					</button>
				</div>
			</div>

			<!-- Slot Machine Game -->
			<div class="group relative">
				<div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-red-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
					<!-- Coming Soon Badge -->
					<div class="absolute -top-3 -right-3 bg-gradient-to-r from-red-400 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
						Coming Soon
					</div>
					
					<!-- Game Icon -->
					<div class="flex justify-center mb-6">
						<div class="w-24 h-24 bg-gradient-to-br from-white to-gray-200 rounded-2xl p-4 shadow-lg group-hover:shadow-red-500/20 transition-all duration-300">
							<img src="/icons/slot-machine.svg" alt="Slot Machine" class="w-full h-full" />
						</div>
					</div>
					
					<!-- Game Info -->
					<h3 class="text-2xl font-bold text-center mb-4 text-red-400">Slot Machine</h3>
					<p class="text-gray-300 text-center mb-6 leading-relaxed">
						Pull the lever and watch the reels spin! Match symbols across paylines for massive jackpot opportunities.
					</p>
					
					<!-- Features -->
					<div class="space-y-2 mb-6">
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
							Multiple paylines
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
							Progressive jackpots
						</div>
						<div class="flex items-center text-sm text-gray-400">
							<div class="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
							Bonus round features
						</div>
					</div>
					
					<!-- Notify Button -->
					<button class="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg">
						Notify Me
					</button>
				</div>
			</div>
		</div>

		<!-- Call to Action Section -->
		<div class="text-center mt-16">
			<div class="bg-gradient-to-r from-purple-800/50 to-blue-800/50 rounded-2xl p-8 border border-purple-500/30 max-w-4xl mx-auto">
				<h2 class="text-3xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
					Stay in the Loop
				</h2>
				<p class="text-gray-300 mb-6 text-lg">
					Be the first to know when these exciting games launch! Follow us on social media or join our community for updates.
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
							<h4 class="font-bold text-yellow-400">Q2 2025 - Dice Roll</h4>
							<p class="text-gray-400 text-sm">Classic dice game with multiple betting strategies</p>
						</div>
					</div>
					<div class="flex items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
						<div class="w-4 h-4 bg-blue-500 rounded-full mr-4"></div>
						<div>
							<h4 class="font-bold text-blue-400">Q3 2025 - Spin Wheel</h4>
							<p class="text-gray-400 text-sm">Colorful wheel of fortune with exciting multipliers</p>
						</div>
					</div>
					<div class="flex items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
						<div class="w-4 h-4 bg-red-500 rounded-full mr-4"></div>
						<div>
							<h4 class="font-bold text-red-400">Q4 2025 - Slot Machine</h4>
							<p class="text-gray-400 text-sm">Multi-payline slots with progressive jackpots</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>