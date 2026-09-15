const path = require("path");
const express = require("express");
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

app.get("/health", (req, res) => res.json({ status: "ok", service: config.appName }));

// Milestone 2+ mount routers here:
//   app.use("/api", require("./routes/api"));
//   app.use("/admin", require("./routes/admin"));
//   app.use("/checkout", require("./routes/checkout"));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
