<template>
  <main class="flex h-dvh flex-col">
    <HamburgerMenu />
    <CardGrid class="min-h-0 flex-1">
      <template #on-deck>
        <OnDeckSlot />
      </template>
    </CardGrid>
  </main>
</template>
