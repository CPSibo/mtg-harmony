<template>
  <div class="relative overflow-hidden size-full">
    <!-- Grid background -->
    <svg
      class="absolute inset-0 size-full"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="play-area-grid-pattern"
          x="0"
          y="0"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <!-- Major grid lines -->
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="currentColor"
            stroke-width="0.5"
            class="stroke-inverted/15"
          />
          <!-- Minor cross at center -->
          <circle
            cx="20"
            cy="20"
            r="0.75"
            fill="currentColor"
            class="text-inverted stroke-inverted/7"
          />
        </pattern>

        <!-- Vignette gradient overlay -->
        <radialGradient
          id="play-area-vignette"
          cx="50%"
          cy="50%"
          r="70%"
        >
          <stop
            offset="0%"
            stop-color="transparent"
          />
          <stop
            offset="100%"
            stop-color="black"
            stop-opacity="0.65"
          />
        </radialGradient>
      </defs>

      <!-- Grid fill -->
      <rect
        width="100%"
        height="100%"
        fill="url(#play-area-grid-pattern)"
      />

      <!-- Vignette overlay -->
      <rect
        width="100%"
        height="100%"
        fill="url(#play-area-vignette)"
        stroke="none"
      />
    </svg>

    <!-- Content slot sits above the pattern -->
    <div class="relative size-full">
      <slot />
    </div>
  </div>
</template>
