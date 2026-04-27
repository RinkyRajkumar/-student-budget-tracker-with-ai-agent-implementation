import { Router } from "express";
import { db } from "../db/index.js";

const router = Router();

router.get("/", (_req, res) => {
  const categories = db.prepare("SELECT id, name, color FROM categories ORDER BY name").all();
  res.json({ categories });
});

export default router;
