import React from "react";

const toggleInArray = (arr = [], value) =>
  arr.includes(value) ? arr.filter((item) => item !== value) : [...arr, value];

export const DynamicField = ({ field, value, onChange }) => {
  const commonProps = {
    required: Boolean(field.required)
  };

  if (field.type === "textarea") {
    return <textarea rows="3" value={value || ""} onChange={(e) => onChange(e.target.value)} {...commonProps} />;
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
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} {...commonProps}>
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
      {...commonProps}
    />
  );
};

export default DynamicField;
