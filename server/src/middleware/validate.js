export function validate(schema) {
  return (req, _res, next) => {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params
    });
    req.validated = parsed;
    next();
  };
}
