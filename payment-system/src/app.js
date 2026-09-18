const path = require("path");
const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const expressLayouts = require("express-ejs-layouts");

const config = require("./config");
const requestLogger = require("./middleware/requestLogger");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(requestLogger);

function sessionMiddleware(cookieName) {
  return session({
    name: cookieName,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 4 },
  });
}

// Admin and merchant logins get their own session cookie - real separate
// identities (like Stripe's dashboard vs internal admin tooling being
// entirely different apps), so a browser can be logged into both an admin
// account and a merchant account at once without one login overwriting the
// other's session. They share one login page/form (routes/auth.js), which
// picks the right one of these by the authenticated user's role.
const adminSession = sessionMiddleware("admin.sid");
const merchantSession = sessionMiddleware("merchant.sid");
const adminFlash = flash();
const merchantFlash = flash();

// Every /admin and /dashboard page is dynamic and session-specific - never
// let a browser (or its back-forward cache) reuse a stale copy after a
// mutation, which otherwise shows up as "I saved a change but it still
// shows the old data" on refresh/back. Express sets an ETag on every
// response by default; that's fine for static assets but wrong here.
function noStore(req, res, next) {
  res.set("Cache-Control", "no-store");
  next();
}

app.use("/admin", adminSession, adminFlash, noStore);
app.use("/dashboard", merchantSession, merchantFlash, noStore);
app.use("/login", noStore);

app.use((req, res, next) => {
  res.locals.appName = config.appName;
  res.locals.adminName = (req.session && req.session.adminName) || null;
  res.locals.merchantName = (req.session && req.session.merchantName) || null;
  res.locals.success = typeof req.flash === "function" ? req.flash("success") : [];
  res.locals.errorFlash = typeof req.flash === "function" ? req.flash("error") : [];
  next();
});

app.get("/health", (req, res) => res.json({ status: "ok", service: config.appName }));
app.get("/", (req, res) => res.render("home", { status: "ok" }));
app.use("/docs", require("./routes/docs"));

app.use(require("./routes/auth")({ adminSession, merchantSession, adminFlash, merchantFlash }));

app.use("/api", require("./routes/api"));
app.use("/checkout", require("./routes/checkout"));
app.use("/admin", require("./routes/admin"));
app.use("/dashboard", require("./routes/dashboard"));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
