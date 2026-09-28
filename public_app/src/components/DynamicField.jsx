import React from "react";

const toggleInArray = (arr = [], value) =>
  arr.includes(value) ? arr.filter((item) => item !== value) : [...arr, value];

export const DynamicField = ({ field, value, onChange }) => {
  // Deliberately no native `required` attribute anywhere in this component: the caller (e.g.
  // ListingForm's submit()) already does its own required-field check with a friendly, specific
  // "Please fill in X" message. A native `required` on a select/number/text input makes the
  // browser silently block the submit event via its own constraint validation before that
  // check - or React's onSubmit - ever runs, with no visible error and no obvious way to tell
  // (confirmed: form.checkValidity() was false and no submit event fired at all).

  if (field.type === "textarea") {
    return <textarea rows="6" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  }

  if (field.type === "boolean") {
    return (
      <label className="checkbox-row">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        <span>Yes</span>
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select an option</option>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  if (field.type === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="checkbox-group">
        {(field.options || []).map((option) => (
          <label key={option} className="checkbox-row">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onChange(toggleInArray(selected, option))}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }

  const inputType = field.type === "number" ? "number"
    : field.type === "date" ? "date"
    : field.type === "time" ? "time"
    : field.type === "url" ? "url"
    : field.type === "phone" ? "tel"
    : "text";

  return (
    <input
      type={inputType}
      value={value ?? ""}
      onChange={(e) => onChange(field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
    />
  );
};

export default DynamicField;
