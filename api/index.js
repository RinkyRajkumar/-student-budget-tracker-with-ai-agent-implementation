process.env.DB_PATH ||= "/tmp/student-budget.sqlite";

let appPromise;

export default async function handler(req, res) {
  if (!appPromise) {
    appPromise = import("../server/src/app.js").then(({ createApp }) => createApp());
  }

  const app = await appPromise;
  return app(req, res);
}
