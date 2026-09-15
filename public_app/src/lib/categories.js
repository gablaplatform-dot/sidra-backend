export const flattenCategories = (items = [], parentName = "") =>
  items.flatMap((item) => [
    { ...item, path: parentName ? `${parentName} / ${item.name}` : item.name },
    ...flattenCategories(item.children || [], parentName ? `${parentName} / ${item.name}` : item.name)
  ]);

export const findCategoryPath = (items = [], id, ancestors = []) => {
  for (const item of items) {
    if (item.id === id) return { node: item, ancestors };
    const found = findCategoryPath(item.children || [], id, [...ancestors, item]);
    if (found) return found;
  }
  return null;
};
