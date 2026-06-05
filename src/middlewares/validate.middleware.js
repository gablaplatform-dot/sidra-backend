import { AppError } from "../utils/AppError.js";

export const validate = (schema, property = "body") => {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });

    if (error) {
      return next(
        new AppError({
          message: "Validation Error",
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

