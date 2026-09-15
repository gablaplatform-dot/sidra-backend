import React from "react";

export const Field = ({ label, children, hint, as: Tag = "label" }) => (
  <Tag className="field">
    <span>{label}</span>
    {children}
    {hint ? <small>{hint}</small> : null}
  </Tag>
);

export default Field;
