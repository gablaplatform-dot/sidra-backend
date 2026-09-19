import React from "react";

// Renders whatever a provider answered for their category's custom questions during onboarding
// (Category.providerFields definitions + Provider.customFields values) - shown publicly on their
// "About" section, unlike contact/location which stay behind the unlock gate (see ContactSidebar).
//
// This needs a stricter "was this actually answered" check than lib/customFields#isCustomFieldFilled
// (which treats every boolean as filled, since a form checkbox is always either true or false once
// rendered) - here an absent key means the provider never touched the question, and a boolean field
// they skipped must not be displayed as if they'd explicitly answered "No".
const isFieldAnswered = (field, value) => {
  if (value === undefined || value === null) return false;
  if (field.type === "multi_select") return Array.isArray(value) && value.length > 0;
  if (field.type === "boolean") return typeof value === "boolean";
  return String(value).trim() !== "";
};

const formatValue = (field, value) => {
  if (field.type === "boolean") return value ? "Yes" : "No";
  if (field.type === "multi_select") return Array.isArray(value) ? value.join(", ") : "";
  if (field.type === "url") {
    return (
      <a href={value} target="_blank" rel="noreferrer">{value}</a>
    );
  }
  return field.unit ? `${value} ${field.unit}` : String(value);
};

export default function ProviderCustomFields({ fields = [], values = {} }) {
  const answered = fields.filter((field) => isFieldAnswered(field, values?.[field.key]));
  if (!answered.length) return null;

  return (
    <dl className="provider-custom-fields">
      {answered.map((field) => (
        <div key={field.key} className="provider-custom-field-row">
          <dt>{field.label}</dt>
          <dd>{formatValue(field, values[field.key])}</dd>
        </div>
      ))}
    </dl>
  );
}

export const hasAnsweredCustomFields = (fields = [], values = {}) =>
  fields.some((field) => isFieldAnswered(field, values?.[field.key]));
