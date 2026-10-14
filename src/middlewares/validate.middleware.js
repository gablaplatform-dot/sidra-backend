import { AppError } from "../utils/AppError.js";

export const validate = (schema, property = "body") => {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });

    if (error) {
      // The first problem, in plain words, so the apps (which show only `message`) can tell people what to fix.
      const first = error.details[0]?.message?.replace(/"/g, "") ?? "";
      const readable = first ? `${first.charAt(0).toUpperCase()}${first.slice(1)}` : "Validation Error";
      return next(
        new AppError({
          message: readable,
          statusCode: 400,
          code: "VALIDATION_ERROR",
          details: error.details.map((d) => ({ message: d.message, path: d.path }))
        })
      );
    }

    req[property] = value;
    next();
  };
};

