const path = require("path");
const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const expressLayouts = require("express-ejs-layouts");

const config = require("./config");
const requestLogger = require("./middleware/requestLogger");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const apiRouter = require("./routes/api");
const adminRouter = require("./routes/admin");
const otpRouter = require("./routes/otp");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(requestLogger);

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 4 },
  })
);
app.use(flash());

app.use((req, res, next) => {
  res.locals.bankName = config.bankName;
  res.locals.bankCode = config.bankCode;
  res.locals.adminName = req.session.adminName || null;
  res.locals.success = req.flash("success");
  res.locals.errorFlash = req.flash("error");
  next();
});

app.get("/health", (req, res) => res.json({ status: "ok", bank: config.bankName }));

app.use("/api", apiRouter);
app.use("/admin", adminRouter);
// Public, customer-facing OTP challenge page - deliberately NOT under /api
// (that's apiKeyAuth-protected server-to-server surface, and a customer's
// browser has no API key) and NOT under /admin (no session/login here -
// see routes/otp.js for its actual trust model).
app.use("/otp", otpRouter);
app.get("/", (req, res) => res.redirect("/admin/dashboard"));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
