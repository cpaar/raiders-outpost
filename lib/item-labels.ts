export const stripBlueprintLabel = (label: string) =>
  label
    .replace(/^\s*(blueprint|bauplan|blaupause)\s*:\s*/i, "")
    .replace(/\s*(blueprint|bauplan|blaupause)\s*$/i, "")
    .trim();

export const stripFurnitureDesignLabel = (label: string) =>
  label
    .replace(/^\s*(entwurf|design)\s*:\s*/i, "")
    // German labels also attach "entwurf" directly, e.g. "Kronleuchterentwurf".
    .replace(/(?:\s*[-–—]?\s*entwurf|[\s–—-]+design)\s*$/i, "")
    .trim();
