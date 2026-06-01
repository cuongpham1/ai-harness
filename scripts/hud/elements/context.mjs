export async function getContextElement(inputJson, config) {
  const usedPercentage = inputJson.context_window?.used_percentage;
  if (typeof usedPercentage === 'number') {
    const color = config.colors.context;
    const reset = config.colors.reset;
    return `${color}ctx: ${usedPercentage.toFixed(1)}%${reset}`;
  }
  return null;
}