import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PackKind, PicoPackAiRecipe, ZPackAiRecipe } from '~/services/ai-recipe-generator.server';

// Bridges a mounted recipe editor page (PicoPackEditor / RecipeEditor) to the AI Brewmaster
// sidekick, which now renders once globally from MainLayout instead of being embedded directly in
// each editor. The editor still owns all of its own recipe state and generate/edit logic — this
// context just republishes "what recipe is currently being edited, and how do I apply an AI
// draft/edit to it" so the globally-rendered sidekick can drive whichever editor happens to be on
// screen, exactly as it did when it was a prop passed straight into that editor.

export type AiRecipeBridge = {
  packType: PackKind;
  hasContent: boolean;
  recipeLabel: string;
  currentRecipe: PicoPackAiRecipe | ZPackAiRecipe;
  onGenerated: (recipe: PicoPackAiRecipe | ZPackAiRecipe) => void;
};

type SetBridge = (bridge: AiRecipeBridge | null) => void;

// Split into two contexts rather than one `{ bridge, setBridge }` object: useRegisterAiRecipeBridge
// (called by the recipe editor, on every render, to keep the bridge current) only ever needs the
// setter, and useState's setter is referentially stable across renders — so as long as it reads
// ONLY this context, the editor never re-renders just because it called setBridge. If it also
// subscribed to the reactive `bridge` value (e.g. via one combined context), every setBridge call
// would re-render the editor too, which would re-run its registration effect, which would call
// setBridge again — an infinite loop. useAiSidekickBridge (the sidekick itself) is the only thing
// that reads the reactive value, and it never calls setBridge, so it can react freely.
const SetBridgeContext = createContext<SetBridge | null>(null);
const BridgeValueContext = createContext<AiRecipeBridge | null>(null);

export function AiSidekickProvider({ children }: { children: ReactNode }) {
  const [bridge, setBridge] = useState<AiRecipeBridge | null>(null);
  return (
    <SetBridgeContext.Provider value={setBridge}>
      <BridgeValueContext.Provider value={bridge}>{children}</BridgeValueContext.Provider>
    </SetBridgeContext.Provider>
  );
}

// Called by a recipe editor page on every render while it's mounted and editable (pass `null` in
// read-only mode, matching the old `!readOnly && ...` gate around the sidekick). No dependency
// array on the effect — the bridge closes over the editor's live recipe state, so it needs to stay
// current on every keystroke, the same way the sidekick used to just re-render with fresh props.
export function useRegisterAiRecipeBridge(bridge: AiRecipeBridge | null) {
  const setBridge = useContext(SetBridgeContext);
  if (!setBridge) {
    throw new Error('useRegisterAiRecipeBridge must be used within an AiSidekickProvider (see MainLayout.tsx)');
  }
  useEffect(() => {
    setBridge(bridge);
    return () => setBridge(null);
  });
}

export function useAiSidekickBridge(): AiRecipeBridge | null {
  return useContext(BridgeValueContext);
}
