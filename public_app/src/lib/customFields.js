export const isCustomFieldFilled = (field, value) => {
  if (field.type === "boolean") return true;
  if (field.type === "multi_select") return Array.isArray(value) && value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
};
