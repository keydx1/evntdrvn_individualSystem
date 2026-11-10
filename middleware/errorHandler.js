export const notFound = (req, res) => {
  res.status(404).render("errors/error", {
    title: "Page not found",
    status: 404,
    message: "The page you are looking for does not exist or may have been moved.",
  });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.error(error);

  return res.status(500).render("errors/error", {
    title: "Something went wrong",
    status: 500,
    message:
      "The station system hit an unexpected problem. Please try again, or ask an administrator to check the server log.",
  });
};
