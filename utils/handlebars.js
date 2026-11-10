import hbs from "hbs";
import { can } from "../middleware/auth.js";
import { pieChart, trendChart } from "./charts.js";
import {
  dateInput,
  formatDate,
  formatDateTime,
  initials,
  money,
  movementClass,
  movementLabel,
  number,
  signed,
  stockStatus,
  userRoleLabel,
} from "./helpers.js";

export const registerViewHelpers = () => {
  hbs.registerHelper("eq", (left, right) => String(left) === String(right));
  hbs.registerHelper("ne", (left, right) => String(left) !== String(right));
  hbs.registerHelper("gt", (left, right) => Number(left) > Number(right));
  hbs.registerHelper("gte", (left, right) => Number(left) >= Number(right));
  hbs.registerHelper("lt", (left, right) => Number(left) < Number(right));
  hbs.registerHelper("lte", (left, right) => Number(left) <= Number(right));
  hbs.registerHelper("and", (left, right) => Boolean(left) && Boolean(right));
  hbs.registerHelper("or", (left, right) => Boolean(left) || Boolean(right));
  hbs.registerHelper("not", (value) => !value);
  hbs.registerHelper("add", (left, right) => Number(left) + Number(right));
  hbs.registerHelper("subtract", (left, right) => Number(left) - Number(right));
  hbs.registerHelper("formatDate", formatDate);
  hbs.registerHelper("formatDateTime", formatDateTime);
  hbs.registerHelper("dateInput", dateInput);
  hbs.registerHelper("money", money);
  hbs.registerHelper("number", number);
  hbs.registerHelper("signed", signed);
  hbs.registerHelper("initials", initials);
  hbs.registerHelper("stockStatus", stockStatus);
  hbs.registerHelper("roleLabel", userRoleLabel);
  // {{#if (can "products.manage")}} — same rule as the route middleware.
  hbs.registerHelper("can", (permission, options) => can(options?.data?.root?.currentUser, permission));
  hbs.registerHelper("movementLabel", movementLabel);
  hbs.registerHelper("movementClass", movementClass);
  hbs.registerHelper("json", (value) => JSON.stringify(value));
  hbs.registerHelper("selected", (value, expected) =>
    String(value) === String(expected) ? "selected" : ""
  );
  hbs.registerHelper("checked", (value) => (value ? "checked" : ""));
  // Charts are emitted with triple braces: {{{ trendChart trend }}}
  hbs.registerHelper("trendChart", (series) => trendChart(series));
  hbs.registerHelper("pieChart", (segments) => pieChart(segments));
};
