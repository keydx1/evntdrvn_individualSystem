import bcrypt from "bcryptjs";
import { User } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isEmail } from "../utils/validation.js";

export const loginPage = (req, res) => {
  if (req.session?.userId) return res.redirect("/");
  return res.render("login", {
    title: "Sign in",
    email: "",
    errors: [],
  });
};

export const loginUser = asyncHandler(async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");

  const errors = [];
  if (!email) errors.push("Email address is required.");
  else if (!isEmail(email)) errors.push("Enter a valid email address.");
  if (!password) errors.push("Password is required.");

  if (errors.length > 0) {
    return res.status(422).render("login", { title: "Sign in", email, errors });
  }

  const user = await User.findOne({ where: { email } });
  const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;

  if (!user || !user.isActive || !passwordMatches) {
    return res.status(422).render("login", {
      title: "Sign in",
      email,
      errors: ["Invalid email or password. Please try again."],
    });
  }

  await new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });

  req.session.userId = user.id;
  req.flash("success_msg", `Welcome back, ${user.name.split(" ")[0]}!`);

  return res.redirect("/");
});

export const logoutUser = (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("aquapiol.sid");
    return res.redirect("/login");
  });
};
