<script>
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  // Props with sensible defaults
  export let title = 'ETH Shot - Take Your Shot at the ETH Jackpot';
  export let description = 'A viral, pay-to-play, Ethereum-powered game where users take a chance to win an ETH jackpot by clicking a single button. 0.0005 ETH per shot, 1% chance to win!';
  export let keywords = 'ethereum, eth, jackpot, game, crypto, blockchain, gambling, web3, defi, shot';
  export let author = 'ETH Shot';
  export let image = '/logo.svg';
  export let imageAlt = 'ETH Shot - Ethereum Jackpot Game';
  export let imageWidth = '1200';
  export let imageHeight = '630';
  export let type = 'website';
  export let siteName = 'ETH Shot';
  export let locale = 'en_US';
  export let twitterCard = 'summary_large_image';
  export let twitterSite = '@ethshot';
  export let twitterCreator = '@ethshot';
  export let themeColor = '#667eea';
  export let robots = 'index, follow';
  export let canonical = null;
  export let publishedTime = null;
  export let modifiedTime = null;
  export let section = null;
  export let tags = null;
  export let video = null;
  export let videoType = null;
  export let videoWidth = null;
  export let videoHeight = null;
  export let audio = null;
  export let audioType = null;
  export let appId = null;
  export let admins = null;

  // Reactive variables
  $: currentUrl = browser ? window.location.href : ($page?.url?.href || 'https://ethshot.io');
  $: canonicalUrl = canonical || currentUrl;
  $: fullImageUrl = image?.startsWith('http') ? image : `${new URL(currentUrl).origin}${image}`;
  $: fullTitle = title.includes('ETH Shot') ? title : `${title} | ETH Shot`;
  
  // Generate structured data
  $: structuredData = {
    "@context": "https://schema.org",
    "@type": type === 'article' ? 'Article' : 'WebSite',
    "name": fullTitle,
    "description": description,
    "url": canonicalUrl,
    "image": fullImageUrl,
    "author": {
      "@type": "Organization",
      "name": author
    },
    "publisher": {
      "@type": "Organization",
      "name": siteName,
      "logo": {
        "@type": "ImageObject",
        "url": `${new URL(currentUrl).origin}/logo.svg`
      }
    },
    ...(publishedTime && { "datePublished": publishedTime }),
    ...(modifiedTime && { "dateModified": modifiedTime }),
    ...(type === 'website' && {
      "potentialAction": {
        "@type": "SearchAction",
        "target": `${new URL(currentUrl).origin}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    })
  };
</script>

<svelte:head>
  <!-- Basic Meta Tags -->
  <title>{fullTitle}</title>
  <meta name="description" content={description} />
  <meta name="keywords" content={keywords} />
  <meta name="author" content={author} />
  <meta name="robots" content={robots} />
  <meta name="theme-color" content={themeColor} />
  <meta name="msapplication-TileColor" content={themeColor} />
  <meta name="application-name" content={siteName} />
  
  <!-- Canonical URL -->
  <link rel="canonical" href={canonicalUrl} />
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content={type} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:site_name" content={siteName} />
  <meta property="og:locale" content={locale} />
  <meta property="og:image" content={fullImageUrl} />
  <meta property="og:image:alt" content={imageAlt} />
  <meta property="og:image:width" content={imageWidth} />
  <meta property="og:image:height" content={imageHeight} />
  <meta property="og:image:type" content="image/png" />
  
  <!-- Additional Open Graph for Articles -->
  {#if type === 'article'}
    {#if publishedTime}
      <meta property="article:published_time" content={publishedTime} />
    {/if}
    {#if modifiedTime}
      <meta property="article:modified_time" content={modifiedTime} />
    {/if}
    {#if section}
      <meta property="article:section" content={section} />
    {/if}
    {#if tags}
      {#each tags.split(',') as tag}
        <meta property="article:tag" content={tag.trim()} />
      {/each}
    {/if}
  {/if}
  
  <!-- Video Meta Tags -->
  {#if video}
    <meta property="og:video" content={video} />
    {#if videoType}
      <meta property="og:video:type" content={videoType} />
    {/if}
    {#if videoWidth}
      <meta property="og:video:width" content={videoWidth} />
    {/if}
    {#if videoHeight}
      <meta property="og:video:height" content={videoHeight} />
    {/if}
  {/if}
  
  <!-- Audio Meta Tags -->
  {#if audio}
    <meta property="og:audio" content={audio} />
    {#if audioType}
      <meta property="og:audio:type" content={audioType} />
    {/if}
  {/if}
  
  <!-- Facebook App ID -->
  {#if appId}
    <meta property="fb:app_id" content={appId} />
  {/if}
  
  <!-- Facebook Admins -->
  {#if admins}
    <meta property="fb:admins" content={admins} />
  {/if}
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content={twitterCard} />
  <meta name="twitter:site" content={twitterSite} />
  <meta name="twitter:creator" content={twitterCreator} />
  <meta name="twitter:title" content={fullTitle} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={fullImageUrl} />
  <meta name="twitter:image:alt" content={imageAlt} />
  
  <!-- Additional Twitter Meta Tags -->
  {#if twitterCard === 'summary_large_image'}
    <meta name="twitter:image:width" content={imageWidth} />
    <meta name="twitter:image:height" content={imageHeight} />
  {/if}
  
  <!-- Mobile and App Meta Tags -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content={siteName} />
  <meta name="format-detection" content="telephone=no" />
  
  <!-- Apple Touch Icons -->
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  
  <!-- Microsoft Tiles -->
  <meta name="msapplication-TileImage" content="/favicon-32x32.png" />
  <meta name="msapplication-config" content="/browserconfig.xml" />
  
  <!-- Web App Manifest -->
  <link rel="manifest" href="/site.webmanifest" />
  
  <!-- DNS Prefetch for Performance -->
  <link rel="dns-prefetch" href="//fonts.googleapis.com" />
  <link rel="dns-prefetch" href="//cdnjs.cloudflare.com" />
  
  <!-- Preconnect for Critical Resources -->
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  
  <!-- Security Headers -->
  <meta http-equiv="X-Content-Type-Options" content="nosniff" />
  <meta http-equiv="X-Frame-Options" content="DENY" />
  <meta http-equiv="X-XSS-Protection" content="1; mode=block" />
  <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
  
  <!-- Language and Locale -->
  <meta http-equiv="Content-Language" content="en" />
  <link rel="alternate" hreflang="en" href={canonicalUrl} />
  
  <!-- Search Engine Verification (add your verification codes) -->
  <!-- <meta name="google-site-verification" content="your-google-verification-code" /> -->
  <!-- <meta name="bing-site-verification" content="your-bing-verification-code" /> -->
  <!-- <meta name="yandex-verification" content="your-yandex-verification-code" /> -->
  
  <!-- Rich Snippets / Structured Data -->
  <script type="application/ld+json">
    {JSON.stringify(structuredData)}
  </script>
  
  <!-- Additional SEO Meta Tags -->
  <meta name="rating" content="general" />
  <meta name="distribution" content="global" />
  <meta name="revisit-after" content="1 days" />
  <meta name="expires" content="never" />
  <meta name="pragma" content="no-cache" />
  <meta name="cache-control" content="no-cache, no-store, must-revalidate" />
  
  <!-- Geo Location (if applicable) -->
  <!-- <meta name="geo.region" content="US" /> -->
  <!-- <meta name="geo.placename" content="United States" /> -->
  <!-- <meta name="geo.position" content="latitude;longitude" /> -->
  <!-- <meta name="ICBM" content="latitude, longitude" /> -->
  
  <!-- Copyright -->
  <meta name="copyright" content={`© ${new Date().getFullYear()} ${siteName}. All rights reserved.`} />
  
  <!-- Web Monetization (if using) -->
  <!-- <meta name="monetization" content="$ilp.uphold.com/your-payment-pointer" /> -->
</svelte:head>