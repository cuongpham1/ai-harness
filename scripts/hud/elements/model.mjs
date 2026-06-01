export async function getModelElement(inputJson, config) {
  const model = inputJson.model?.display_name || inputJson.model || 'Unknown';
  if (model) {
    const color = config.colors.model;
    const reset = config.colors.reset;
    return `${color}${model}${reset}`;
  }
  return null;
}