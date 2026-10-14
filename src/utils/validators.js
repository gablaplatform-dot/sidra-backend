import Joi from "joi";

// Links the apps will render must be web links: a `javascript:` or `data:` address in an ad, a website field or a
// custom field would run script when someone taps it.
export const httpUrl = (max = 1000) => Joi.string().uri({ scheme: ["http", "https"] }).max(max);

// Where an ad or button may point: a path inside the app, or an http(s) address.
export const linkTarget = (max = 500) =>
  Joi.string()
    .trim()
    .max(max)
    .custom((value, helpers) => (/^\/(?!\/|\\)/.test(value) || /^https?:\/\//i.test(value) ? value : helpers.error("any.invalid")))
    .messages({ "any.invalid": "Use a link that starts with / or https://" });

const DANGEROUS = /^\s*(?:javascript|data|vbscript):/i;

// Free-form answer objects (listing and provider custom fields): bounded in size so one request can't carry
// hundreds of kilobytes of text through the scanners, and free of script links.
export const boundedAnswers = ({ maxKeys = 80, maxValueChars = 2000, maxTotalChars = 20000 } = {}) =>
  Joi.object()
    .unknown(true)
    .custom((value, helpers) => {
      const keys = Object.keys(value);
      if (keys.length > maxKeys) return helpers.message(`Too many answers (max ${maxKeys}).`);
      let total = 0;
      const walk = (v, depth) => {
        if (depth > 3) return "These answers are nested too deeply.";
        if (typeof v === "string") {
          total += v.length;
          if (v.length > maxValueChars) return `An answer is too long (max ${maxValueChars} characters).`;
          if (DANGEROUS.test(v)) return "Links must start with http:// or https://.";
        } else if (Array.isArray(v)) {
          for (const item of v.slice(0, 200)) {
            const problem = walk(item, depth + 1);
            if (problem) return problem;
          }
        } else if (v && typeof v === "object") {
          for (const [k, item] of Object.entries(v)) {
            total += k.length;
            const problem = walk(item, depth + 1);
            if (problem) return problem;
          }
        }
        return null;
      };
      for (const [k, v] of Object.entries(value)) {
        total += k.length;
        const problem = walk(v, 0);
        if (problem) return helpers.message(problem);
      }
      if (total > maxTotalChars) return helpers.message("These answers are too long overall.");
      return value;
    });
